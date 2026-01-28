/**
 * GraphQL hardening: depth limiting, cost analysis, introspection control.
 *
 * These are standard GraphQL ValidationRule factories that can be passed to
 * graphql-js `validate()` or any Envelop/Apollo/Yoga pipeline.
 */

import {
  GraphQLError,
  type ASTNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type ValidationContext,
  type ValidationRule,
} from 'graphql';

/* ------------------------------------------------------------------ */
/* Depth limiting                                                      */
/* ------------------------------------------------------------------ */

function getQueryDepth(
  node: ASTNode,
  fragments: Record<string, FragmentDefinitionNode>,
  depth: number = 0,
): number {
  if (node.kind === 'Field') {
    const field = node as FieldNode;
    if (!field.selectionSet) return depth;
    return Math.max(
      ...field.selectionSet.selections.map((sel) => {
        if (sel.kind === 'FragmentSpread') {
          const frag = fragments[sel.name.value];
          return frag ? getQueryDepth(frag, fragments, depth + 1) : depth;
        }
        return getQueryDepth(sel, fragments, depth + 1);
      }),
    );
  }
  if ('selectionSet' in node && node.selectionSet) {
    return Math.max(
      ...(node as any).selectionSet.selections.map((sel: any) => {
        if (sel.kind === 'FragmentSpread') {
          const frag = fragments[sel.name.value];
          return frag ? getQueryDepth(frag, fragments, depth + 1) : depth;
        }
        return getQueryDepth(sel, fragments, depth + 1);
      }),
    );
  }
  return depth;
}

export function graphqlDepthLimit(maxDepth: number = 8): ValidationRule {
  return function DepthLimitRule(context: ValidationContext) {
    return {
      Document: {
        leave() {
          const fragments: Record<string, FragmentDefinitionNode> = {};
          for (const def of context.getDocument().definitions) {
            if (def.kind === 'FragmentDefinition') {
              fragments[def.name.value] = def;
            }
          }
          for (const def of context.getDocument().definitions) {
            if (def.kind === 'OperationDefinition') {
              const depth = getQueryDepth(def, fragments, 0);
              if (depth > maxDepth) {
                context.reportError(
                  new GraphQLError(
                    `Query depth ${depth} exceeds maximum allowed depth of ${maxDepth}`,
                  ),
                );
              }
            }
          }
        },
      },
    };
  } as ValidationRule;
}

/* ------------------------------------------------------------------ */
/* Cost analysis                                                       */
/* ------------------------------------------------------------------ */

function calculateCost(
  node: ASTNode,
  fragments: Record<string, FragmentDefinitionNode>,
): number {
  if (node.kind === 'Field') {
    const field = node as FieldNode;
    if (!field.selectionSet) return 1; // scalar
    // Fields with selections cost 10 (assumes list-like)
    const fieldCost = 10;
    let childCost = 0;
    for (const sel of field.selectionSet.selections) {
      if (sel.kind === 'FragmentSpread') {
        const frag = fragments[sel.name.value];
        if (frag) childCost += calculateCost(frag, fragments);
      } else {
        childCost += calculateCost(sel, fragments);
      }
    }
    return fieldCost + childCost;
  }
  if ('selectionSet' in node && node.selectionSet) {
    let cost = 0;
    for (const sel of (node as any).selectionSet.selections) {
      if (sel.kind === 'FragmentSpread') {
        const frag = fragments[sel.name.value];
        if (frag) cost += calculateCost(frag, fragments);
      } else {
        cost += calculateCost(sel, fragments);
      }
    }
    return cost;
  }
  return 1;
}

export function graphqlCostLimit(maxCost: number = 1000): ValidationRule {
  return function CostLimitRule(context: ValidationContext) {
    return {
      Document: {
        leave() {
          const fragments: Record<string, FragmentDefinitionNode> = {};
          for (const def of context.getDocument().definitions) {
            if (def.kind === 'FragmentDefinition') {
              fragments[def.name.value] = def;
            }
          }
          for (const def of context.getDocument().definitions) {
            if (def.kind === 'OperationDefinition') {
              const cost = calculateCost(def, fragments);
              if (cost > maxCost) {
                context.reportError(
                  new GraphQLError(
                    `Query cost ${cost} exceeds maximum allowed cost of ${maxCost}`,
                  ),
                );
              }
            }
          }
        },
      },
    };
  } as ValidationRule;
}

/* ------------------------------------------------------------------ */
/* Disable introspection in production                                 */
/* ------------------------------------------------------------------ */

export function disableIntrospectionInProd(): ValidationRule {
  return function DisableIntrospectionRule(context: ValidationContext) {
    if (process.env.NODE_ENV !== 'production') {
      return {};
    }
    return {
      Field(node: FieldNode) {
        const fieldName = node.name.value;
        if (fieldName === '__schema' || fieldName === '__type') {
          context.reportError(
            new GraphQLError('Introspection is disabled in production'),
          );
        }
      },
    };
  } as ValidationRule;
}

/* ------------------------------------------------------------------ */
/* Convenience: all hardening rules                                    */
/* ------------------------------------------------------------------ */

export interface GraphQLHardeningOptions {
  maxDepth?: number;
  maxCost?: number;
}

export function graphqlHardeningRules(
  opts?: GraphQLHardeningOptions,
): ValidationRule[] {
  return [
    graphqlDepthLimit(opts?.maxDepth ?? 8),
    graphqlCostLimit(opts?.maxCost ?? 1000),
    disableIntrospectionInProd(),
  ];
}
