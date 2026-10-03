/**
 * Lectura de valores finales de tokens para los pocos sitios que necesitan un color literal
 * (meta theme-color del navegador). Sale de tokens/figma.json, nunca de valores escritos a mano.
 */
import figma from '../../tokens/figma.json';

type Value = string | number | boolean | { alias: string } | undefined;
const variables = figma.variables as unknown as { name: string; values: Record<string, Value> }[];
const byName = new Map(variables.map((v) => [v.name, v]));

export function resolveToken(name: string, mode?: string): string {
  const variable = byName.get(name);
  if (!variable) throw new Error(`Token desconocido: ${name}`);
  const value = mode && mode in variable.values ? variable.values[mode] : Object.values(variable.values)[0];
  if (typeof value === 'object' && value !== null && 'alias' in value) return resolveToken(value.alias);
  return String(value);
}
