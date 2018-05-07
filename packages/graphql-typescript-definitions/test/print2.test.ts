import * as path from 'path';
import {buildSchema, parse, GraphQLSchema, Source, concatAST} from 'graphql';
import {stripIndent} from 'common-tags';
import {compile} from 'graphql-tool-utilities/ast';

import {printFile, Options} from '../src/print2';

describe('printFile()', () => {
  describe('scalars', () => {
    it('prints a string type', () => {
      const schema = buildSchema(`
        type Query {
          firstName: String!
          lastName: String
        }
      `);

      expect(print('query Details { firstName, lastName }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            firstName: string;
            lastName?: string | null;
          }
        `);
    });

    it('prints an integer type', () => {
      const schema = buildSchema(`
        type Query {
          age: Int!
          jerseyNumber: Int
        }
      `);

      expect(print('query Details { age, jerseyNumber }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            age: number;
            jerseyNumber?: number | null;
          }
        `);
    });

    it('prints a float type', () => {
      const schema = buildSchema(`
        type Query {
          weight: Float!
          pantSize: Float
        }
      `);

      expect(print('query Details { weight, pantSize }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            weight: number;
            pantSize?: number | null;
          }
        `);
    });

    it('prints a boolean type', () => {
      const schema = buildSchema(`
        type Query {
          married: Boolean!
          deterministic: Boolean
        }
      `);

      expect(print('query Details { married, deterministic }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            married: boolean;
            deterministic?: boolean | null;
          }
        `);
    });

    it('prints an ID type', () => {
      const schema = buildSchema(`
        type Query {
          sin: ID!
          driversLicense: ID
        }
      `);

      expect(print('query Details { sin, driversLicense }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            sin: string;
            driversLicense?: string | null;
          }
        `);
    });
  });

  describe('custom scalars', () => {
    it('prints a custom scalar type', () => {
      const schema = buildSchema(`
        scalar Date

        type Query {
          dateOfBirth: Date
        }
      `);

      expect(print('query Details { dateOfBirth }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            dateOfBirth?: Date | null;
          }
        `);
    });

    it('imports the scalar from the schema types file', () => {
      const filename = path.resolve('DetailsQuery.graphql');
      const schemaTypesPath = path.resolve('Schema.ts');
      const schema = buildSchema(`
        scalar Date

        type Query {
          dateOfBirth: Date
        }
      `);

      expect(
        print('query Details { dateOfBirth }', schema, {
          filename,
          printOptions: {schemaTypesPath},
        }),
      ).toContain(stripIndent`
        import { Date } from "${expectedImportPath(filename, schemaTypesPath)}";
      `);
    });
  });

  describe('enums', () => {
    it('prints an enum type', () => {
      const schema = buildSchema(`
        enum Faction {
          EMPIRE
          REBELS
        }

        type Query {
          faction: Faction!
        }
      `);

      expect(print('query Details { faction }', schema)).toContain(stripIndent`
        export interface DetailsQueryData {
          faction: Faction;
        }
      `);
    });

    it('imports the enum from the schema types file', () => {
      const filename = path.resolve('DetailsQuery.graphql');
      const schemaTypesPath = path.resolve('Schema.ts');
      const schema = buildSchema(`
        enum Faction {
          EMPIRE
          REBELS
        }

        type Query {
          faction: Faction!
        }
      `);

      expect(
        print('query Details { faction }', schema, {
          filename,
          printOptions: {schemaTypesPath},
        }),
      ).toContain(stripIndent`
        import { Faction } from "${expectedImportPath(
          filename,
          schemaTypesPath,
        )}";
      `);
    });
  });

  describe('lists', () => {
    it('prints list types with non-null members', () => {
      const schema = buildSchema(`
        type Query {
          listOne: [String!]!
          listTwo: [String!]
        }
      `);

      expect(print('query Details { listOne, listTwo }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            listOne: string[];
            listTwo?: string[] | null;
          }
        `);
    });

    it('prints list types with nullable members', () => {
      const schema = buildSchema(`
        type Query {
          listOne: [String]!
          listTwo: [String]
        }
      `);

      expect(print('query Details { listOne, listTwo }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            listOne: (string | null)[];
            listTwo?: (string | null)[] | null;
          }
        `);
    });

    it('prints nested lists', () => {
      const schema = buildSchema(`
        type Query {
          listOne: [[String!]]!
          listTwo: [[String]]
        }
      `);

      expect(print('query Details { listOne, listTwo }', schema))
        .toContain(stripIndent`
          export interface DetailsQueryData {
            listOne: (string[] | null)[];
            listTwo?: ((string | null)[] | null)[] | null;
          }
        `);
    });
  });

  describe('objects', () => {
    it('does not export a namespace when there are no nested objects', () => {
      const schema = buildSchema(`
        type Query {
          name: String!
        }
      `);

      expect(print('query Details { name }', schema)).not.toContain(
        'export namespace DetailsQueryData',
      );
    });

    it('prints a nested object', () => {
      const schema = buildSchema(`
        type Person {
          name: String!
          age: Int!
        }

        type Query {
          self: Person!
          partner: Person
        }
      `);

      expect(
        print(
          `
          query Details {
            self { name }
            partner { age }
          }
          `,
          schema,
        ),
      ).toContain(stripIndent`
        export namespace DetailsQueryData {
          export interface Self {
            name: string;
          }
          export interface Partner {
            age: number;
          }
        }
        export interface DetailsQueryData {
          self: DetailsQueryData.Self;
          partner?: DetailsQueryData.Partner | null;
        }
      `);
    });

    it('prints a deeply nested object', () => {
      const schema = buildSchema(`
        type Person {
          name: String!
          partner: Person
        }

        type Query {
          self: Person!
        }
      `);

      expect(
        print(
          `
          query Details {
            self { partner { name } }
          }
          `,
          schema,
        ),
      ).toContain(stripIndent`
        export namespace DetailsQueryData {
          export interface SelfPartner {
            name: string;
          }
          export interface Self {
            partner?: DetailsQueryData.SelfPartner | null;
          }
        }
        export interface DetailsQueryData {
          self: DetailsQueryData.Self;
        }
      `);
    });

    it('prints a deeply nested object with alias field names', () => {
      const schema = buildSchema(`
        type Person {
          name: String!
          partner: Person
        }

        type Query {
          self: Person!
        }
      `);

      expect(
        print(
          `
          query Details {
            self {
              partner { nom: name }
              wife: partner { name }
            }
          }
          `,
          schema,
        ),
      ).toContain(stripIndent`
        export namespace DetailsQueryData {
          export interface SelfPartner {
            nom: string;
          }
          export interface SelfWife {
            name: string;
          }
          export interface Self {
            partner?: DetailsQueryData.SelfPartner | null;
            wife?: DetailsQueryData.SelfWife | null;
          }
        }
        export interface DetailsQueryData {
          self: DetailsQueryData.Self;
        }
      `);
    });

    describe('__typename', () => {
      const schema = buildSchema(`
        type Person {
          name: String!
        }

        type Query {
          self: Person!
        }
      `);

      it('does not add a typename when the option is falsy', () => {
        expect(
          print('query Details { self { name } }', schema, {
            printOptions: {addTypename: false},
          }),
        ).not.toContain('__typename');
      });

      it('adds an explicit typename when the option is truthy', () => {
        expect(
          print('query Details { self { name } }', schema, {
            printOptions: {addTypename: true},
          }),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface Self {
              __typename: "Person";
              name: string;
            }
          }
          export interface DetailsQueryData {
            self: DetailsQueryData.Self;
          }
        `);
      });

      it('does not duplicate an explicit typename field', () => {
        expect(
          print('query Details { self { __typename } }', schema, {
            printOptions: {addTypename: true},
          }),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface Self {
              __typename: "Person";
            }
          }
          export interface DetailsQueryData {
            self: DetailsQueryData.Self;
          }
        `);
      });

      it('adds an explicit typename field when it is requested with a different responseName', () => {
        expect(
          print('query Details { self { type: __typename } }', schema, {
            printOptions: {addTypename: true},
          }),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface Self {
              __typename: "Person";
              type: "Person";
            }
          }
          export interface DetailsQueryData {
            self: DetailsQueryData.Self;
          }
        `);
      });
    });

    describe('interfaces', () => {
      function createBasicInterfaceSchema() {
        return buildSchema(`
          interface Named {
            name: String!
          }

          type Person implements Named {
            name: String!
            occupation: String
          }

          type Dog implements Named {
            name: String!
            legs: Int!
          }

          type Cat implements Named {
            name: String!
            livesLeft: Int!
          }

          type Query {
            named: Named
          }
        `);
      }

      it('collapses the type when an inline fragment is guaranteed', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print('query Details { named { ...on Named { name } } }', schema),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface Named {
              name: string;
            }
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.Named | null;
          }
        `);
      });

      it('splits out a catch-all type for interfaces where not all possible types are queried', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            'query Details { named { ...on Person { occupation } } }',
            schema,
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              occupation?: string | null;
            }
            export interface NamedOther {}
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedOther | null;
          }
        `);
      });

      it('adds guaranteed fields to each union type field', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            `query Details {
              named {
                name
                ...on Person { occupation }
                ...on Dog { legs }
              }
            }`,
            schema,
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              name: string;
              occupation?: string | null;
            }
            export interface NamedDog {
              name: string;
              legs: number;
            }
            export interface NamedOther {
              name: string;
            }
          }
        `);
      });

      it('adds explicit typename to each union type', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            `query Details {
              named {
                __typename
                ...on Person { occupation }
                ...on Dog { legs }
                ...on Cat { livesLeft }
              }
            }`,
            schema,
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              __typename: "Person";
              occupation?: string | null;
            }
            export interface NamedDog {
              __typename: "Dog";
              legs: number;
            }
            export interface NamedCat {
              __typename: "Cat";
              livesLeft: number;
            }
          }
        `);
      });

      it('adds implicit typename to each union type when the option is set', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person { occupation }
                ...on Dog { legs }
                ...on Cat { livesLeft }
              }
            }`,
            schema,
            {printOptions: {addTypename: true}},
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              __typename: "Person";
              occupation?: string | null;
            }
            export interface NamedDog {
              __typename: "Dog";
              legs: number;
            }
            export interface NamedCat {
              __typename: "Cat";
              livesLeft: number;
            }
          }
        `);
      });

      it('splits other typename into the catch-all union type', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person { occupation }
              }
            }`,
            schema,
            {printOptions: {addTypename: true}},
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              __typename: "Person";
              occupation?: string | null;
            }
            export interface NamedOther {
              __typename: "Dog" | "Cat";
            }
          }
        `);
      });

      it('collapses a type when a fragment spread is guaranteed', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            `query Details {
              named {
                ...NamedFragment
              }
            }

            fragment NamedFragment on Named {
              name
            }`,
            schema,
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface Named {
              name: string;
            }
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.Named | null;
          }
        `);
      });

      it('separates out the type for a non-guaranteed fragment spread', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person { ...PersonFragment }
              }
            }

            fragment PersonFragment on Person {
              occupation
            }`,
            schema,
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              occupation?: string | null;
            }
            export interface NamedOther {}
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedOther | null;
          }
        `);
      });

      it('resolves types from external fragments', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person { ...PersonFragment }
              }
            }`,
            schema,
            {
              fragments: {
                'PersonFragment.graphql': `
                  fragment PersonFragment on Person {
                    occupation
                  }
                `,
              },
            },
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              occupation?: string | null;
            }
            export interface NamedOther {}
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedOther | null;
          }
        `);
      });

      it('resolves fragment spreads that contain inline fragments', () => {
        const schema = createBasicInterfaceSchema();

        expect(
          print(
            `query Details {
              named {
                ...NamedFragment
              }
            }`,
            schema,
            {
              printOptions: {addTypename: true},
              fragments: {
                'NamedFragment.graphql': `
                  fragment NamedFragment on Named {
                    name
                    ...on Person { occupation }
                    ...on Dog { legs }
                  }
                `,
              },
            },
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              __typename: "Person";
              name: string;
              occupation?: string | null;
            }
            export interface NamedDog {
              __typename: "Dog";
              name: string;
              legs: number;
            }
            export interface NamedOther {
              __typename: "Cat";
              name: string;
            }
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedDog | DetailsQueryData.NamedOther | null;
          }
        `);
      });
    });

    describe('unions', () => {
      function createBasicUnionSchema() {
        return buildSchema(`
          type Person implements Named {
            name: String!
            occupation: String
            pets: [Pet!]!
          }

          type Dog implements Named {
            name: String!
            legs: Int!
          }

          type Cat implements Named {
            name: String!
            livesLeft: Int!
          }

          union Named = Person | Dog | Cat
          union Pet = Dog | Cat

          type Query {
            named: Named
          }
        `);
      }

      it('splits out a catch-all type for interfaces where not all possible types are queried', () => {
        const schema = createBasicUnionSchema();

        expect(
          print(
            'query Details { named { ...on Person { occupation } } }',
            schema,
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              occupation?: string | null;
            }
            export interface NamedOther {}
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedOther | null;
          }
        `);
      });

      it('adds explicit typename to each union type', () => {
        const schema = createBasicUnionSchema();

        expect(
          print(
            `query Details {
              named {
                __typename
                ...on Person { occupation }
                ...on Dog { legs }
                ...on Cat { livesLeft }
              }
            }`,
            schema,
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              __typename: "Person";
              occupation?: string | null;
            }
            export interface NamedDog {
              __typename: "Dog";
              legs: number;
            }
            export interface NamedCat {
              __typename: "Cat";
              livesLeft: number;
            }
          }
        `);
      });

      it('adds implicit typename to each union type when the option is set', () => {
        const schema = createBasicUnionSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person { occupation }
                ...on Dog { legs }
                ...on Cat { livesLeft }
              }
            }`,
            schema,
            {printOptions: {addTypename: true}},
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              __typename: "Person";
              occupation?: string | null;
            }
            export interface NamedDog {
              __typename: "Dog";
              legs: number;
            }
            export interface NamedCat {
              __typename: "Cat";
              livesLeft: number;
            }
          }
        `);
      });

      it('splits other typename into the catch-all union type', () => {
        const schema = createBasicUnionSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person { occupation }
              }
            }`,
            schema,
            {printOptions: {addTypename: true}},
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              __typename: "Person";
              occupation?: string | null;
            }
            export interface NamedOther {
              __typename: "Dog" | "Cat";
            }
          }
        `);
      });

      it('separates out the type for a fragment spread', () => {
        const schema = createBasicUnionSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person { ...PersonFragment }
              }
            }

            fragment PersonFragment on Person {
              occupation
            }`,
            schema,
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              occupation?: string | null;
            }
            export interface NamedOther {}
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedOther | null;
          }
        `);
      });

      it('resolves types from external fragments', () => {
        const schema = createBasicUnionSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person { ...PersonFragment }
              }
            }`,
            schema,
            {
              fragments: {
                'PersonFragment.graphql': `
                  fragment PersonFragment on Person {
                    occupation
                  }
                `,
              },
            },
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              occupation?: string | null;
            }
            export interface NamedOther {}
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedOther | null;
          }
        `);
      });

      it('resolves fragment spreads that contain inline fragments', () => {
        const schema = createBasicUnionSchema();

        expect(
          print(
            `query Details {
              named {
                ...NamedFragment
              }
            }`,
            schema,
            {
              printOptions: {addTypename: true},
              fragments: {
                'NamedFragment.graphql': `
                  fragment NamedFragment on Named {
                    ...on Person { name, occupation }
                    ...on Dog { legs }
                  }
                `,
              },
            },
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPerson {
              __typename: "Person";
              name: string;
              occupation?: string | null;
            }
            export interface NamedDog {
              __typename: "Dog";
              legs: number;
            }
            export interface NamedOther {
              __typename: "Cat";
            }
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedDog | DetailsQueryData.NamedOther | null;
          }
        `);
      });

      it('resolves union types nested within other union types', () => {
        const schema = createBasicUnionSchema();

        expect(
          print(
            `query Details {
              named {
                ...on Person {
                  pets {
                    ...on Dog { legs }
                  }
                }
              }
            }`,
            schema,
            {printOptions: {addTypename: true}},
          ),
        ).toContain(stripIndent`
          export namespace DetailsQueryData {
            export interface NamedPetsDog {
              __typename: "Dog";
              legs: number;
            }
            export interface NamedPetsOther {
              __typename: "Cat";
            }
            export interface NamedPerson {
              __typename: "Person";
              pets: (DetailsQueryData.NamedPetsDog | DetailsQueryData.NamedPetsOther)[];
            }
            export interface NamedOther {
              __typename: "Dog" | "Cat";
            }
          }
          export interface DetailsQueryData {
            named?: DetailsQueryData.NamedPerson | DetailsQueryData.NamedOther | null;
          }
        `);
      });
    });
  });

  describe('variables', () => {
    it('does not output variables if the query does not accept them', () => {
      const schema = buildSchema(`
        type Query {
          name: String!
        }
      `);

      expect(print('query Details { name }', schema)).not.toContain(
        'export interface Variables',
      );
    });

    it('outputs out a variable declaration', () => {
      const schema = buildSchema(`
        type Query {
          identity(aString: String!): String!
        }
      `);

      expect(
        print(
          'query Details($aString: String!) { identity(aString: $string) }',
          schema,
        ),
      ).toContain(stripIndent`
        export namespace DetailsQueryData {
          export interface Variables {
            aString: string;
          }
        }
      `);
    });

    it('outputs out a variable declaration with nullable members', () => {
      const schema = buildSchema(`
        type Query {
          identity(aString: String): String
        }
      `);

      expect(
        print(
          'query Details($aString: String) { identity(aString: $string) }',
          schema,
        ),
      ).toContain(stripIndent`
        export namespace DetailsQueryData {
          export interface Variables {
            aString?: string | null;
          }
        }
      `);
    });

    it('outputs out a variable declaration with list members', () => {
      const schema = buildSchema(`
        type Query {
          concat(strings: [String]!): String!
        }
      `);

      expect(
        print(
          'query Details($strings: [String]!) { concat(strings: $strings) }',
          schema,
        ),
      ).toContain(stripIndent`
        export namespace DetailsQueryData {
          export interface Variables {
            strings: (string | null)[];
          }
        }
      `);
    });

    it('outputs out a variable declaration with imported types', () => {
      const filename = path.resolve('DetailsQuery.graphql');
      const schemaTypesPath = path.resolve('Schema.ts');
      const schema = buildSchema(`
        input CreateInput {
          name: String!
        }

        enum Occupation {
          PROGRAMMER
          OTHER
        }

        scalar Date

        type Query {
          name(create: CreateInput, occupation: Occupation, date: Date): String
        }
      `);

      const printed = print(
        'query Details($create: CreateInput, $occupation: Occupation!, $date: Date) { name(aString: $string) }',
        schema,
      );

      expect(printed).toContain(stripIndent`
        export namespace DetailsQueryData {
          export interface Variables {
            create?: CreateInput | null;
            occupation: Occupation;
            date?: Date | null;
          }
        }
      `);

      expect(printed).toContain(
        `import { CreateInput, Occupation, Date } from "${expectedImportPath(
          filename,
          schemaTypesPath,
        )}";`,
      );
    });

    it('uses the variables as the second type argument to DocumentNode', () => {
      const schema = buildSchema(`
        type Query {
          identity(aString: String!): String!
        }
      `);

      expect(
        print(
          'query Details($aString: String!) { identity(aString: $string) }',
          schema,
        ),
      ).toContain(stripIndent`
        declare const document: DocumentNode<DetailsQueryData, DetailsQueryData.Variables>;
      `);
    });
  });

  describe('directives', () => {
    it('makes a non-null field optional when it has the include directive', () => {
      const schema = buildSchema(`
        type Query {
          name: String!
        }
      `);

      expect(
        print(
          'query Details($condition: Bool!) { name @include(if: $condition) }',
          schema,
        ),
      ).toContain(stripIndent`
        export interface DetailsQueryData {
          name?: string | null;
        }
      `);
    });

    it('makes a non-null field optional when it has the skip directive', () => {
      const schema = buildSchema(`
        type Query {
          name: String!
        }
      `);

      expect(
        print(
          'query Details($condition: Bool!) { name @skip(if: $condition) }',
          schema,
        ),
      ).toContain(stripIndent`
        export interface DetailsQueryData {
          name?: string | null;
        }
      `);
    });

    it('does not change field typings for other directives', () => {
      const schema = buildSchema(`
        type Query {
          name: String!
        }
      `);

      expect(
        print('query Details($baz: Bool!) { name @foo(bar: $baz) }', schema),
      ).toContain(stripIndent`
        export interface DetailsQueryData {
          name: string;
        }
      `);
    });
  });

  describe('document', () => {
    it('imports DocumentNode from graphql-typed', () => {
      const schema = buildSchema(`
        type Query {
          name: String!
        }
      `);

      expect(print('query Details { name }', schema)).toContain(
        'import { DocumentNode } from "graphql-typed";',
      );
    });

    it('exports a DocumentNode as the default export with the operation data type annotation', () => {
      const schema = buildSchema(`
        type Query {
          name: String!
        }
      `);

      expect(print('query Details { name }', schema)).toContain(stripIndent`
        declare const document: DocumentNode<DetailsQueryData, never>;
        export default document;
      `);
    });
  });
});

function expectedImportPath(from: string, to: string) {
  const relative = path.relative(path.dirname(from), to);
  return relative.startsWith('..') ? relative : `./${relative}`;
}

interface TestOptions {
  fragments?: {[key: string]: string};
  filename?: string;
  printOptions?: Partial<Options>;
}

function print(
  documentString: string,
  schema: GraphQLSchema,
  {
    fragments = {},
    filename = path.resolve('MyOperation.graphql'),
    printOptions = {},
  }: TestOptions = {},
) {
  const finalOptions = {
    addTypename: false,
    schemaTypesPath: path.resolve('Schema.ts'),
    ...printOptions,
  };
  const fragmentDocuments = Object.keys(fragments).map((key) =>
    parse(new Source(fragments[key], key)),
  );
  const document = parse(new Source(documentString, filename));
  const ast = compile(schema, concatAST([document, ...fragmentDocuments]));
  const file = {
    path: filename,
    operations: Object.keys(ast.operations)
      .map((key) => ast.operations[key])
      .filter((operation) => operation.filePath === filename),
    fragments: Object.keys(ast.fragments)
      .map((key) => ast.fragments[key])
      .filter((fragment) => fragment.filePath === filename),
  };
  return printFile(file, ast, finalOptions);
}