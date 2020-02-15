"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const common_tags_1 = require("common-tags");
const webpack_1 = __importDefault(require("../src/webpack"));
describe('graphql-mini-transforms/webpack', () => {
    it('marks the loader as cacheable', () => __awaiter(this, void 0, void 0, function* () {
        const loader = createLoaderContext();
        const cacheableSpy = jest.spyOn(loader, 'cacheable');
        yield simulateRun(`query Shop { shop { id } }`, loader);
        expect(cacheableSpy).toHaveBeenCalled();
    }));
    it('exports the document as the default export', () => __awaiter(this, void 0, void 0, function* () {
        expect(yield simulateRun(`query Shop { shop { id } }`)).toMatch(/^export default /);
    }));
    it('removes locations for all nodes other than the document', () => __awaiter(this, void 0, void 0, function* () {
        expect(yield extractDocumentExport(`query Shop { shop }`)).not.toHaveProperty('definitions.0.loc');
    }));
    it('exposes the source on the document', () => __awaiter(this, void 0, void 0, function* () {
        expect(yield extractDocumentExport(`query Shop { shop { id } }`)).toHaveProperty('loc.source.body', expect.any(String));
    }));
    it('adds typenames to selection sets', () => __awaiter(this, void 0, void 0, function* () {
        expect(yield extractDocumentExport(`query Shop { shop { id } }`)).toHaveProperty('loc.source.body', expect.stringContaining('__typename'));
    }));
    it('minifies the source', () => __awaiter(this, void 0, void 0, function* () {
        const originalSource = common_tags_1.stripIndent `
      # Comments should go away
      # As should extra space
      query Shop ( $id : ID! , $first: Number! ) {
        # Most whitespace should go too
        shop ( id:   $id, first: $first ) {
          # Should also minify selection sets
          id,
          name,
        }
      }
    `;
        const expectedSource = `query Shop($id:ID!,$first:Number!){shop(id:$id,first:$first){id name __typename}}`;
        expect(yield extractDocumentExport(originalSource)).toHaveProperty('loc.source.body', expectedSource);
    }));
    it('adds an ID property that is a sha256 hash of the query document', () => __awaiter(this, void 0, void 0, function* () {
        const result = yield extractDocumentExport(`query Shop { shop { id } }`);
        expect(result).toHaveProperty('id', crypto_1.createHash('sha256')
            .update(result.loc.source.body)
            .digest('hex'));
    }));
    it('has option for custom ID generate function', () => __awaiter(this, void 0, void 0, function* () {
        const result = yield extractDocumentExport(`query Shop { shop { id } }`, createLoaderContext({ loaderOptions: { generateId: () => 'foo' } }));
        expect(result).toHaveProperty('id', 'foo');
    }));
    describe('import', () => {
        it('adds the resolved import as a dependency', () => __awaiter(this, void 0, void 0, function* () {
            const context = '/app/';
            const imported = './FooFragment.graphql';
            const resolvedPath = path.resolve(imported);
            const loader = createLoaderContext({
                context,
                resolve: () => resolvedPath,
                readFile: () => `fragment FooFragment on Shop { id }`,
            });
            const resolveSpy = jest.spyOn(loader, 'resolve');
            const addDependencySpy = jest.spyOn(loader, 'addDependency');
            yield simulateRun(common_tags_1.stripIndent `
          #import '${imported}';

          query Shop {
            shop {
              ...FooFragment
            }
          }
        `, loader);
            expect(resolveSpy).toHaveBeenCalledWith(context, imported, expect.any(Function));
            expect(addDependencySpy).toHaveBeenCalledWith(resolvedPath);
        }));
        it('includes imported sources if they are used', () => __awaiter(this, void 0, void 0, function* () {
            const context = '/app/';
            const loader = createLoaderContext({
                context,
                readFile: () => `fragment FooFragment on Shop { id }`,
            });
            const { loc: { source: { body }, }, } = yield extractDocumentExport(common_tags_1.stripIndent `
          #import './FooFragment.graphql';

          query Shop {
            shop {
              ...FooFragment
            }
          }
        `, loader);
            expect(body).toContain('...FooFragment');
            expect(body).toContain('fragment FooFragment on Shop');
        }));
        it('includes multiple imported sources', () => __awaiter(this, void 0, void 0, function* () {
            const context = '/app/';
            const fragmentFiles = new Map([
                ['/app/FooFragment.graphql', 'fragment FooFragment on Shop { id }'],
                ['/app/BarFragment.graphql', 'fragment BarFragment on Shop { name }'],
            ]);
            const loader = createLoaderContext({
                context,
                readFile: (file) => fragmentFiles.get(file),
            });
            const { loc: { source: { body }, }, } = yield extractDocumentExport(common_tags_1.stripIndent `
          #import './FooFragment.graphql';
          #import './BarFragment.graphql';

          query Shop {
            shop {
              ...FooFragment
              ...BarFragment
            }
          }
        `, loader);
            expect(body).toContain('...FooFragment');
            expect(body).toContain('...BarFragment');
            expect(body).toContain('fragment FooFragment on Shop');
            expect(body).toContain('fragment BarFragment on Shop');
        }));
        it('excludes imported sources if they are not used', () => __awaiter(this, void 0, void 0, function* () {
            const context = '/app/';
            const loader = createLoaderContext({
                context,
                readFile: () => `fragment FooFragment on Shop { id }`,
            });
            const { loc: { source: { body }, }, } = yield extractDocumentExport(common_tags_1.stripIndent `
        #import './FooFragment.graphql';

        query Shop {
          shop {
            id
          }
        }
      `, loader);
            expect(body).not.toContain('fragment FooFragment on Shop');
        }));
    });
});
// This is a limited subset of the loader API that we actually use in our
// loader.
function createLoaderContext({ context = __dirname, readFile = () => '', resolve = (context, imported) => path.resolve(context, imported), loaderOptions = undefined, } = {}) {
    return {
        context,
        fs: {
            readFile(file, withFile) {
                const read = readFile(file);
                if (typeof read === 'string') {
                    withFile(null, Buffer.from(read, 'utf8'));
                }
                else {
                    withFile(read);
                }
            },
        },
        cacheable() { },
        async() {
            return () => { };
        },
        resolve(context, imported, withResolved) {
            const resolved = resolve(context, imported);
            if (typeof resolved === 'string') {
                withResolved(null, resolved);
            }
            else {
                withResolved(resolved);
            }
        },
        addDependency() { },
        query: loaderOptions,
    };
}
function extractDocumentExport(source, loader = createLoaderContext()) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield simulateRun(source, loader);
        return JSON.parse(result.replace(/^export default /, '').replace(/;$/, ''));
    });
}
function simulateRun(source, loader = createLoaderContext()) {
    return new Promise((resolve, reject) => {
        Reflect.defineProperty(loader, 'async', {
            value: () => (error, result) => {
                if (error == null) {
                    resolve(result || '');
                }
                else {
                    reject(error);
                }
            },
        });
        webpack_1.default.call(loader, source);
    });
}
