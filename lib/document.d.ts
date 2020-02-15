import { DocumentNode } from 'graphql';
export interface CleanDocumentOptions {
    removeUnused?: boolean;
    generateId?(normalizedSource: string): string;
}
export declare function cleanDocument(document: DocumentNode, { removeUnused, generateId }?: CleanDocumentOptions): DocumentNode;
export declare function extractImports(rawSource: string): {
    imports: string[];
    source: string;
};
