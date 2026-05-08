import { Node } from 'ts-morph';

export function getColumn(node: Node): number {
  const sourceFile = node.getSourceFile();
  return sourceFile.getLineAndColumnAtPos(node.getStart()).column;
}
