from __future__ import annotations

from ipaddress import IPv4Address, IPv6Address, ip_address, ip_network
from typing import Iterable

LOOPBACK_IP = ip_address("127.0.0.1")
ALLOW_ALL_CIDRS = ["0.0.0.0/0", "::/0"]


def normalize_cidrs(values: Iterable[str] | None) -> list[str]:
    if values is None:
        return []

    normalized: list[str] = []
    for value in values:
        cidr = str(ip_network(str(value).strip(), strict=False))
        if cidr not in normalized:
            normalized.append(cidr)
    return normalized


def parse_ip(value: str | None) -> IPv4Address | IPv6Address | None:
    if value is None:
        return None

    candidate = value.strip().removeprefix("[").removesuffix("]")
    if not candidate:
        return None
    if candidate in {"localhost", "testclient"}:
        return LOOPBACK_IP
    try:
        parsed = ip_address(candidate)
        if isinstance(parsed, IPv6Address) and parsed.ipv4_mapped is not None:
            return parsed.ipv4_mapped
        return parsed
    except ValueError:
        return None


def ip_matches_cidrs(value: IPv4Address | IPv6Address | None, cidrs: Iterable[str]) -> bool:
    if value is None:
        return False
    return any(value in ip_network(cidr, strict=False) for cidr in cidrs)


def resolve_client_ip(
    peer_host: str | None,
    x_forwarded_for: str | None,
    trusted_proxy_cidrs: Iterable[str],
) -> IPv4Address | IPv6Address:
    peer_ip = parse_ip(peer_host) or LOOPBACK_IP
    if not x_forwarded_for or not ip_matches_cidrs(peer_ip, trusted_proxy_cidrs):
        return peer_ip

    for part in x_forwarded_for.split(","):
        forwarded_ip = parse_ip(part)
        if forwarded_ip is not None:
            return forwarded_ip
    return peer_ip
