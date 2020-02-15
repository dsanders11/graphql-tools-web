"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const graphql_1 = require("graphql");
const IMPORT_REGEX = /^#import\s+['"]([^'"]*)['"];?[\s\n]*/gm;
const DEFAULT_NAME = 'Operation';
function defaultGenerateId(normalizedSource) {
    // This ID is a hash of the full file contents that are part of the document,
    // including other documents that are injected in, but excluding any unused
    // fragments. This is useful for things like persisted queries.
    return crypto_1.createHash('sha256').update(normalizedSource).digest('hex');
}
function cleanDocument(document, { removeUnused = true, generateId = defaultGenerateId } = {}) {
    if (removeUnused) {
        removeUnusedDefinitions(document);
    }
    for (const definition of document.definitions) {
        addTypename(definition);
    }
    const normalizedSource = minifySource(graphql_1.print(document));
    const normalizedDocument = graphql_1.parse(normalizedSource);
    for (const definition of normalizedDocument.definitions) {
        stripLoc(definition);
    }
    const id = generateId(normalizedSource);
    Reflect.defineProperty(normalizedDocument, 'id', {
        value: id,
        enumerable: true,
        writable: false,
        configurable: false,
    });
    Reflect.defineProperty(normalizedDocument, 'loc', {
        value: stripDocumentLoc(normalizedDocument.loc),
        enumerable: true,
        writable: false,
        configurable: false,
    });
    return normalizedDocument;
}
exports.cleanDocument = cleanDocument;
function extractImports(rawSource) {
    const imports = new Set();
    const source = rawSource.replace(IMPORT_REGEX, (_, imported) => {
        imports.add(imported);
        return '';
    });
    return { imports: [...imports], source };
}
exports.extractImports = extractImports;
function removeUnusedDefinitions(document) {
    const usedDefinitions = new Set();
    const dependencies = definitionDependencies(document.definitions);
    const markAsUsed = (definition) => {
        if (usedDefinitions.has(definition)) {
            return;
        }
        usedDefinitions.add(definition);
        for (const dependency of dependencies.get(definition) || []) {
            markAsUsed(dependency);
        }
    };
    for (const definition of document.definitions) {
        if (definition.kind !== 'FragmentDefinition') {
            markAsUsed(definition);
        }
    }
    document.definitions = [...usedDefinitions];
}
function minifySource(source) {
    return source
        .replace(/#.*/g, '')
        .replace(/\\n/g, ' ')
        .replace(/\s\s+/g, ' ')
        .replace(/\s*({|}|\(|\)|\.|:|,)\s*/g, '$1');
}
function definitionDependencies(definitions) {
    const executableDefinitions = definitions.filter((definition) => definition.kind === 'OperationDefinition' ||
        definition.kind === 'FragmentDefinition');
    const definitionsByName = new Map(executableDefinitions.map((definition) => [
        definition.name ? definition.name.value : DEFAULT_NAME,
        definition,
    ]));
    return new Map(executableDefinitions.map((executableNode) => [
        executableNode,
        [...collectUsedFragmentSpreads(executableNode, new Set())].map((usedFragment) => {
            const definition = definitionsByName.get(usedFragment);
            if (definition == null) {
                throw new Error(`You attempted to use the fragment '${usedFragment}' (in '${executableNode.name ? executableNode.name.value : DEFAULT_NAME}'), but it does not exist. Maybe you forgot to import it from another document?`);
            }
            return definition;
        }),
    ]));
}
const TYPENAME_FIELD = {
    kind: 'Field',
    alias: null,
    name: { kind: 'Name', value: '__typename' },
};
function addTypename(definition) {
    for (const { selections } of selectionSetsForDefinition(definition)) {
        const hasTypename = selections.some((selection) => selection.kind === 'Field' && selection.name.value === '__typename');
        if (!hasTypename) {
            selections.push(TYPENAME_FIELD);
        }
    }
}
function collectUsedFragmentSpreads(definition, usedSpreads) {
    for (const selection of selectionsForDefinition(definition)) {
        if (selection.kind === 'FragmentSpread') {
            usedSpreads.add(selection.name.value);
        }
    }
    return usedSpreads;
}
function selectionsForDefinition(definition) {
    if (!('selectionSet' in definition) || definition.selectionSet == null) {
        return [][Symbol.iterator]();
    }
    return selectionsForSelectionSet(definition.selectionSet);
}
function* selectionSetsForDefinition(definition) {
    if (!('selectionSet' in definition) || definition.selectionSet == null) {
        return [][Symbol.iterator]();
    }
    if (definition.kind !== 'OperationDefinition') {
        yield definition.selectionSet;
    }
    for (const nestedSelection of selectionsForDefinition(definition)) {
        if ('selectionSet' in nestedSelection &&
            nestedSelection.selectionSet != null) {
            yield nestedSelection.selectionSet;
        }
    }
}
function* selectionsForSelectionSet({ selections, }) {
    for (const selection of selections) {
        yield selection;
        if ('selectionSet' in selection && selection.selectionSet != null) {
            yield* selectionsForSelectionSet(selection.selectionSet);
        }
    }
}
function stripDocumentLoc(loc) {
    const normalizedLoc = Object.assign({}, loc);
    delete normalizedLoc.endToken;
    delete normalizedLoc.startToken;
    return normalizedLoc;
}
function stripLoc(value) {
    if (Array.isArray(value)) {
        value.forEach(stripLoc);
    }
    else if (typeof value === 'object') {
        if (value == null) {
            return;
        }
        if ('loc' in value) {
            delete value.loc;
        }
        for (const key of Object.keys(value)) {
            stripLoc(value[key]);
        }
    }
}
