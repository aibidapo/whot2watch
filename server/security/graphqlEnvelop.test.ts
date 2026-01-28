import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parse, validate, buildSchema } from 'graphql';
import {
  graphqlDepthLimit,
  graphqlCostLimit,
  disableIntrospectionInProd,
} from './graphqlEnvelop';

const schema = buildSchema(`
  type Query {
    user(id: ID!): User
    users: [User]
  }
  type User {
    id: ID!
    name: String
    friends: [User]
    profile: Profile
  }
  type Profile {
    bio: String
    avatar: String
  }
`);

describe('graphqlDepthLimit', () => {
  it('rejects queries exceeding the depth limit', () => {
    // depth: user(1) -> friends(2) -> friends(3) -> friends(4) -> ... up to 10
    const deepQuery = parse(`{
      user(id: "1") {
        friends {
          friends {
            friends {
              friends {
                friends {
                  friends {
                    friends {
                      friends {
                        friends { name }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`);
    const errors = validate(schema, deepQuery, [graphqlDepthLimit(8)]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toMatch(/depth.*exceeds/i);
  });

  it('allows queries within the depth limit', () => {
    const shallowQuery = parse(`{
      user(id: "1") {
        name
        profile { bio }
      }
    }`);
    const errors = validate(schema, shallowQuery, [graphqlDepthLimit(8)]);
    expect(errors).toHaveLength(0);
  });
});

describe('graphqlCostLimit', () => {
  it('rejects high-cost wide queries', () => {
    // Each nested field with selections costs 10 + children
    // Building a query with many nested selections to exceed cost
    const wideQuery = parse(`{
      a1: users { name friends { name friends { name friends { name friends { name } } } } }
      a2: users { name friends { name friends { name friends { name friends { name } } } } }
      a3: users { name friends { name friends { name friends { name friends { name } } } } }
      a4: users { name friends { name friends { name friends { name friends { name } } } } }
      a5: users { name friends { name friends { name friends { name friends { name } } } } }
      a6: users { name friends { name friends { name friends { name friends { name } } } } }
      a7: users { name friends { name friends { name friends { name friends { name } } } } }
      a8: users { name friends { name friends { name friends { name friends { name } } } } }
    }`);
    const errors = validate(schema, wideQuery, [graphqlCostLimit(100)]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toMatch(/cost.*exceeds/i);
  });

  it('allows low-cost queries', () => {
    const simpleQuery = parse(`{ user(id: "1") { name } }`);
    const errors = validate(schema, simpleQuery, [graphqlCostLimit(1000)]);
    expect(errors).toHaveLength(0);
  });
});

describe('disableIntrospectionInProd', () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('blocks introspection in production', () => {
    process.env.NODE_ENV = 'production';
    const introQuery = parse(`{ __schema { types { name } } }`);
    const errors = validate(schema, introQuery, [disableIntrospectionInProd()]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toMatch(/introspection.*disabled/i);
  });

  it('allows introspection in non-production', () => {
    process.env.NODE_ENV = 'development';
    const introQuery = parse(`{ __schema { types { name } } }`);
    const errors = validate(schema, introQuery, [disableIntrospectionInProd()]);
    // Only schema validation errors expected, not our custom error
    const customErrors = errors.filter((e) =>
      e.message.includes('Introspection is disabled'),
    );
    expect(customErrors).toHaveLength(0);
  });
});
