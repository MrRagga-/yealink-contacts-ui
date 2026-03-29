from __future__ import annotations

from cryptography.fernet import Fernet

from yealink_contacts.core.config import get_settings


class SecretCipher:
    def __init__(self) -> None:
        self._cipher = Fernet(get_settings().encryption_key.encode("utf-8"))

    def encrypt(self, value: str) -> str:
        return self._cipher.encrypt(value.encode("utf-8")).decode("utf-8")

    def decrypt(self, value: str) -> str:
        return self._cipher.decrypt(value.encode("utf-8")).decode("utf-8")


cipher = SecretCipher()
