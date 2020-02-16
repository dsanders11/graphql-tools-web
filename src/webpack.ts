import {dirname} from 'path';

import {loader} from 'webpack';
import {parse, DocumentNode} from 'graphql';

import {cleanDocument, extractImports, CleanDocumentOptions} from './document';

export default async function graphQLLoader(
  this: loader.LoaderContext,
  source: string | Buffer,
) {
  this.cacheable();

  const options = this.query;

  if (options && typeof options !== 'object') {
    throw new Error(
      '@shopify/graphql-mini-transforms only supports options as an object',
    );
  }

  const done = this.async();

  if (done == null) {
    throw new Error(
      '@shopify/graphql-loader does not support synchronous processing',
    );
  }

  try {
    const cleanDocumentOptions = {} as CleanDocumentOptions;

    if (options && options.generateId) {
      cleanDocumentOptions.generateId = options.generateId;
    }

    if (options && options.includeSource) {
      cleanDocumentOptions.includeSource = options.includeSource;
    }

    const document = await loadDocument(source, this.context, this);
    done(null, `export default ${JSON.stringify(cleanDocument(document, cleanDocumentOptions))};`);
  } catch (error) {
    done(error);
  }
}

async function loadDocument(
  rawSource: string | Buffer,
  resolveContext: string,
  loader: loader.LoaderContext,
): Promise<DocumentNode> {
  const normalizedSource =
    typeof rawSource === 'string' ? rawSource : rawSource.toString();

  const {imports, source} = extractImports(normalizedSource);
  const document = parse(source);

  if (imports.length === 0) {
    return document;
  }

  const resolvedImports = await Promise.all(
    imports.map(async (imported) => {
      const resolvedPath = await new Promise<string>((resolve, reject) => {
        loader.resolve(resolveContext, imported, (error, result) => {
          if (error) {
            reject(error);
          } else {
            loader.addDependency(result);
            resolve(result);
          }
        });
      });

      const source = await new Promise<string>((resolve, reject) => {
        loader.fs.readFile(
          resolvedPath,
          (error: Error | null, result?: string) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
        );
      });

      return loadDocument(source, dirname(resolvedPath), loader);
    }),
  );

  for (const {definitions} of resolvedImports) {
    (document.definitions as any[]).push(...definitions);
  }

  return document;
}
