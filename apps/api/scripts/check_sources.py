import ast
import io
import sys
import tokenize
from collections.abc import Iterator
from pathlib import Path

CHECKED_DIRECTORIES = ('src', 'tests', 'migrations', 'scripts')

DocumentedNode = ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef


def comment_lines(source: str) -> Iterator[int]:
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type == tokenize.COMMENT:
            yield token.start[0]


def docstring_lines(source: str) -> Iterator[int]:
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, DocumentedNode) or not node.body:
            continue
        first = node.body[0]
        if (
            isinstance(first, ast.Expr)
            and isinstance(first.value, ast.Constant)
            and isinstance(first.value.value, str)
        ):
            yield first.lineno


def violations(root: Path) -> Iterator[str]:
    for directory in CHECKED_DIRECTORIES:
        for path in sorted((root / directory).rglob('*.py')):
            source = path.read_text(encoding='utf-8')
            relative = path.relative_to(root)
            for line in comment_lines(source):
                yield f'{relative}:{line}: comments are not allowed'
            for line in docstring_lines(source):
                yield f'{relative}:{line}: docstrings are not allowed'


def main() -> int:
    found = list(violations(Path(__file__).resolve().parent.parent))
    for violation in found:
        print(violation)
    return 1 if found else 0


if __name__ == '__main__':
    sys.exit(main())
