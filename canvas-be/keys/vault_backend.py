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

from typing import Optional
from .base import SecretStorageBackend
# from logging_handler import get_logger

try:
    import hvac
    from hvac.exceptions import VaultError

    VAULT_AVAILABLE = True
except ImportError:
    VAULT_AVAILABLE = False
    VaultError = Exception

# logger = get_logger("vault_log")


class VaultBackend(SecretStorageBackend):
    """
    VaultBackend provides an implementation of a secret storage backend using HashiCorp Vault.
    This class allows saving, retrieving, and deleting secrets in a Vault server using the hvac
    library.
    It authenticates with Vault using a provided token and interacts with the KV v2 secrets engine.
    Args:
        url (str): The URL of the Vault server.
        token (str): The authentication token for Vault.
        mount_point (str, optional): The mount point of the KV secrets engine. Defaults to "secret".
    Raises:
        RuntimeError: If the 'hvac' package is not installed.
        VaultError: If authentication with Vault fails.
    Methods:
        save_secret(key: str, value: str) -> bool:
            Saves a secret value under the specified key in Vault.
        get_secret(key: str) -> Optional[str]:
            Retrieves the secret value for the specified key from Vault.
        delete_secret(key: str) -> bool:
            Deletes all versions and metadata of the secret for the specified key from Vault.
    """

    def __init__(self, url: str, token: str, mount_point: str = "secret"):
        """
        Initializes the Vault backend client.
        Args:
            url (str): The URL of the HashiCorp Vault server.
            token (str): The authentication token for Vault.
            mount_point (str, optional): The mount point for the secrets engine.
            Defaults to "secret".
        Raises:
            RuntimeError: If the 'hvac' package is not installed.
            VaultError: If authentication with the provided token fails.
        """
        if not VAULT_AVAILABLE:
            raise RuntimeError(
                "Vault backend requires 'hvac' package. Install with: pip install hvac"
            )

        self.client = hvac.Client(url=url, token=token)
        self.mount_point = mount_point

        # Verify authentication
        if not self.client.is_authenticated():
            raise VaultError("Vault authentication failed with provided token")

    def save_secret(self, key: str, value: str) -> bool:
        """
        Saves a secret value to HashiCorp Vault at the specified key.

        Args:
            key (str): The path or key under which the secret will be stored in Vault.
            value (str): The secret value to store.

        Returns:
            bool: True if the secret was saved successfully, False otherwise.

        Logs:
            - Info log on successful save.
            - Error log if saving fails due to a VaultError.
        """
        try:
            self.client.secrets.kv.v2.create_or_update_secret(
                path=key, secret={"value": value}, mount_point=self.mount_point
            )
            # logger.info("Secret saved to Vault: %s", key)
            return True
        except VaultError as e:
            # logger.error("Vault save failed for '%s': %s", key, e)
            return False

    def get_secret(self, key: str) -> Optional[str]:
        """
        Retrieve a secret value from HashiCorp Vault for the given key.

        Args:
            key (str): The key (path) of the secret to retrieve from Vault.

        Returns:
            Optional[str]: The secret value if found, otherwise None.

        Logs:
            - Info: When a secret is successfully retrieved.
            - Warning: If the secret is not found in Vault.
            - Error: If there is a failure reading from Vault other than not found.

        Exceptions:
            Handles VaultError exceptions, logging appropriate messages based on the error.
        """
        try:
            response = self.client.secrets.kv.v2.read_secret_version(
                path=key, mount_point=self.mount_point
            )
            data = response.get("data", {}).get("data", {})
            # logger.info("Secret retrieved from Vault: %s", key)
            return data.get("value")
        except VaultError as e:
            if "not found" in str(e).lower():
                pass
                # logger.warning("Secret not found in Vault: %s", key)
            else:
                pass
                # logger.error("Vault read failed for '%s': %s", key, e)
            return None

    def delete_secret(self, key: str) -> bool:
        """
        Deletes a secret from the HashiCorp Vault at the specified key.

        Args:
            key (str): The path of the secret to delete.

        Returns:
            bool: True if the secret was successfully deleted, False otherwise.

        Logs:
            - Info log on successful deletion.
            - Error log if deletion fails due to a VaultError.
        """
        try:
            self.client.secrets.kv.v2.delete_metadata_and_all_versions(
                path=key, mount_point=self.mount_point
            )
            # logger.info("Secret deleted from Vault: %s", key)
            return True
        except VaultError as e:
            # logger.error("Vault delete failed for '%s': %s", key, e)
            return False
