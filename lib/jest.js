"use strict";
const crypto_1 = require("crypto");
const fs_extra_1 = require("fs-extra");
const graphql_1 = require("graphql");
const document_1 = require("./document");
const THIS_FILE = fs_extra_1.readFileSync(__filename);
const transformer = {
    getCacheKey(fileData, filename) {
        return crypto_1.createHash('md5')
            .update(THIS_FILE)
            .update(fileData)
            .update(filename)
            .digest('hex');
    },
    process(rawSource) {
        const { imports, source } = document_1.extractImports(rawSource);
        const utilityImports = `
      var {print} = require('graphql');
      var {cleanDocument} = require(${JSON.stringify(`${__dirname}/document.js`)});
    `;
        const importSource = imports
            .map((imported, index) => `var importedDocument${index} = require(${JSON.stringify(imported)});`)
            .join('\n');
        const appendDefinitionsSource = imports
            .map((_, index) => `document.definitions.push.apply(document.definitions, importedDocument${index}.definitions);`)
            .join('\n');
        return `
      ${utilityImports}
      ${importSource}

      var document = ${JSON.stringify(graphql_1.parse(source))};

      ${appendDefinitionsSource}

      module.exports = cleanDocument(document, {removeUnused: false});
    `;
    },
};
module.exports = transformer;
