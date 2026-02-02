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

import logging
from typing import Optional
from .base import SecretStorageBackend
from .vault_backend import VaultBackend

# logger = logging.getLogger(__name__)


class StorageFactory:
    """Factory class for creating secret storage backends.

    This class provides a static method to instantiate a storage backend for secrets,
    such as HashiCorp Vault or a fallback option (e.g., SQLite), based on explicit arguments,
    environment variables, or safe defaults.

    Public Methods:
        create_storage: Creates and returns an instance of a secret storage backend.
    """

    @staticmethod
    def create_storage(
        use_vault: Optional[bool] = None,
        vault_url: Optional[str] = None,
        vault_token: Optional[str] = None,
        vault_mount_point: Optional[str] = None,
        # sqlite_path: Optional[str] = None
    ) -> SecretStorageBackend:
        """
        Create storage backend using:
        - Explicit arguments (highest priority)
        - Environment/.env via Config
        - Safe defaults
        """
        if use_vault:
            try:
                return VaultBackend(url=vault_url, token=vault_token, mount_point=vault_mount_point)
            except Exception as e:
                # logger.error("Vault initialization failed: %s. Falling back to SQLite.", e)
                pass
        return None
