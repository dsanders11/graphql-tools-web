"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const graphql_1 = require("graphql");
const document_1 = require("./document");
function graphQLLoader(source) {
    return __awaiter(this, void 0, void 0, function* () {
        this.cacheable();
        const options = this.query;
        if (options && typeof options !== 'object') {
            throw new Error('@shopify/graphql-mini-transforms only supports options as an object');
        }
        const done = this.async();
        if (done == null) {
            throw new Error('@shopify/graphql-loader does not support synchronous processing');
        }
        try {
            const cleanDocumentOptions = {};
            if (options && options.generateId) {
                cleanDocumentOptions.generateId = options.generateId;
            }
            if (options && options.includeSource) {
                cleanDocumentOptions.includeSource = options.includeSource;
            }
            const document = yield loadDocument(source, this.context, this);
            done(null, `export default ${JSON.stringify(document_1.cleanDocument(document, cleanDocumentOptions))};`);
        }
        catch (error) {
            done(error);
        }
    });
}
exports.default = graphQLLoader;
function loadDocument(rawSource, resolveContext, loader) {
    return __awaiter(this, void 0, void 0, function* () {
        const normalizedSource = typeof rawSource === 'string' ? rawSource : rawSource.toString();
        const { imports, source } = document_1.extractImports(normalizedSource);
        const document = graphql_1.parse(source);
        if (imports.length === 0) {
            return document;
        }
        const resolvedImports = yield Promise.all(imports.map((imported) => __awaiter(this, void 0, void 0, function* () {
            const resolvedPath = yield new Promise((resolve, reject) => {
                loader.resolve(resolveContext, imported, (error, result) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        loader.addDependency(result);
                        resolve(result);
                    }
                });
            });
            const source = yield new Promise((resolve, reject) => {
                loader.fs.readFile(resolvedPath, (error, result) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(result);
                    }
                });
            });
            return loadDocument(source, path_1.dirname(resolvedPath), loader);
        })));
        for (const { definitions } of resolvedImports) {
            document.definitions.push(...definitions);
        }
        return document;
    });
}
