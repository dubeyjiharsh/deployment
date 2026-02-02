"""
=============================================================================
COPYRIGHT NOTICE
=============================================================================
© Copyright HCL Technologies Ltd. 2021, 2022, 2023, 2024, 2025
Proprietary and confidential. All information contained herein is, and
remains the property of HCL Technologies Limited. Copying or reproducing the
contents of this file, via any medium is strictly prohibited unless prior
written permission is obtained from HCL Technologies Limited.
"""

from abc import ABC, abstractmethod
from typing import Optional


class SecretStorageBackend(ABC):
    """Abstract base class for secret storage backends."""

    @abstractmethod
    def save_secret(self, key: str, value: str) -> bool:
        """Save a secret. Return True on success."""

    @abstractmethod
    def get_secret(self, key: str) -> Optional[str]:
        """Retrieve a secret. Return value or None if not found."""

    @abstractmethod
    def delete_secret(self, key: str) -> bool:
        """Delete a secret. Return True on success."""
