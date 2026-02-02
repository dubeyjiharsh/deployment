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

from .factory import StorageFactory
# from logging_handler import get_logger

# logger = get_logger("vault_handler")


class VaultHandler:
    """
    VaultHandler provides an interface for securely storing, retrieving, and deleting
    secrets using a configurable backend storage, such as HashiCorp Vault.
    Attributes:
        _use_vault (bool): Indicates whether to use Vault for secret management.
        backend: The storage backend instance created by StorageFactory.
    Methods:
        use_vault: Property to get the current use_vault setting.
        save_json_secret(key: str, value: str) -> bool:
            Saves a secret (as a JSON string) to the backend storage.
        get_json_secret(key: str):
            Retrieves a secret (as a JSON string) from the backend storage.
        delete_json_secret(key: str) -> bool:
            Deletes a secret from the backend storage.
    """

    def __init__(self, use_vault=None, vault_url=None, vault_token=None, vault_mount_point=None):
        self._use_vault = use_vault
        self.backend = StorageFactory.create_storage(
            use_vault=use_vault,
            vault_url=vault_url,
            vault_token=vault_token,
            vault_mount_point=vault_mount_point,
        )

    @property
    def use_vault(self):
        """
        Returns the current state of the _use_vault flag, indicating whether
        the vault functionality is enabled.

        Returns:
            bool: True if vault is in use, False otherwise.
        """
        return self._use_vault

    def save_json_secret(self, key: str, value: str) -> bool:
        """
        Saves a secret (as a JSON string) to the backend storage.

        Args:
            key (str): The key under which the secret is stored.
            value (str): The secret value to be stored, in JSON string format.

        Returns:
            bool: True if the secret was successfully saved, False otherwise.
        """
        try:
            return self.backend.save_secret(key, value)
        except Exception as e:
            # logger.error("Error saving secret to Vault: %s", e)
            return False

    def get_json_secret(self, key: str):
        """
        Retrieve a secret from the Vault as a JSON object.

        Args:
            key (str): The key identifying the secret to retrieve.

        Returns:
            dict or None: The secret as a JSON object if retrieval is successful,
            otherwise None.

        Logs:
            Logs an error message if there is an exception during retrieval.
        """
        try:
            return self.backend.get_secret(key)
        except Exception as e:
            # logger.error("Error retrieving secret from Vault: %s", e)
            return None

    def delete_json_secret(self, key: str) -> bool:
        """
        Deletes a secret from the Vault.

        Args:
            key (str): The key identifying the secret to delete.

        Returns:
            bool: True if the secret was successfully deleted, False otherwise.

        Logs:
            Logs an error message if there is an exception during deletion.
        """
        try:
            return self.backend.delete_secret(key)
        except Exception as e:
            # logger.error("Error deleting secret from Vault: %s", e)
            return False
