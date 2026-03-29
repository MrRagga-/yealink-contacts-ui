from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class QueryNode:
    def evaluate(self, haystack: str) -> bool:
        raise NotImplementedError


@dataclass(frozen=True)
class TermNode(QueryNode):
    term: str

    def evaluate(self, haystack: str) -> bool:
        return self.term in haystack


@dataclass(frozen=True)
class NotNode(QueryNode):
    child: QueryNode

    def evaluate(self, haystack: str) -> bool:
        return not self.child.evaluate(haystack)


@dataclass(frozen=True)
class AndNode(QueryNode):
    left: QueryNode
    right: QueryNode

    def evaluate(self, haystack: str) -> bool:
        return self.left.evaluate(haystack) and self.right.evaluate(haystack)


@dataclass(frozen=True)
class OrNode(QueryNode):
    left: QueryNode
    right: QueryNode

    def evaluate(self, haystack: str) -> bool:
        return self.left.evaluate(haystack) or self.right.evaluate(haystack)


TOKEN_RE = re.compile(r'"[^"]+"|\bAND\b|\bOR\b|\bNOT\b|[(),]|[^\s(),]+', flags=re.IGNORECASE)


class SearchQueryParser:
    def parse(self, query: str) -> QueryNode | None:
        tokens = self._tokenize(query)
        if not tokens:
            return None
        self._tokens = tokens
        self._index = 0
        node = self._parse_or()
        if self._peek() is not None:
            raise ValueError(f"Unexpected token: {self._peek()}")
        return node

    def _tokenize(self, query: str) -> list[str]:
        return [token for token in TOKEN_RE.findall(query) if token.strip()]

    def _parse_or(self) -> QueryNode:
        node = self._parse_and()
        while True:
            token = self._peek()
            if token is None or (token.upper() != "OR" and token != ","):
                break
            self._consume()
            node = OrNode(node, self._parse_and())
        return node

    def _parse_and(self) -> QueryNode:
        node = self._parse_unary()
        while True:
            token = self._peek()
            if token is None or token == ")" or token == "," or token.upper() == "OR":
                break
            if token.upper() == "AND":
                self._consume()
            node = AndNode(node, self._parse_unary())
        return node

    def _parse_unary(self) -> QueryNode:
        token = self._peek()
        if token is None:
            raise ValueError("Unexpected end of query")
        if token.upper() == "NOT":
            self._consume()
            return NotNode(self._parse_unary())
        if token == "(":
            self._consume()
            node = self._parse_or()
            if self._peek() != ")":
                raise ValueError("Missing closing parenthesis")
            self._consume()
            return node
        self._consume()
        return TermNode(token.strip('"').lower())

    def _peek(self) -> str | None:
        if self._index >= len(self._tokens):
            return None
        return self._tokens[self._index]

    def _consume(self) -> str:
        token = self._tokens[self._index]
        self._index += 1
        return token
