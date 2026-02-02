
import os
import hvac
import logging
from dotenv import load_dotenv
from .vault_handler import VaultHandler
from models.schemas import OpenBAOAIForceBearerTokenConfig, OpenBAOAzureLLMConfig

load_dotenv()

# Openbao Configuration
BAO_ADDR = os.getenv("OPENBAO_ADDR")

def read_vault_key_file():
    """ Read the Vault root token from a file. """
    try:
        OPENBAO_ROOT_TOKEN_PATH = os.getenv("OPENBAO_ROOT_TOKEN_PATH")
        with open(os.path.join(OPENBAO_ROOT_TOKEN_PATH, "root_token.txt"), "r", encoding="utf-8") as file:
            token = file.read().strip()
            return token
    except Exception as e:
        logging.error(f"Error reading Vault key file: {e}")
        raise e

def write_bao_secret(secret_data: dict, env: str, app: str) -> bool:
    """
    Write OpenBAO API configuration secrets to the OpenBAO container.
    Accepts a dictionary containing the secret data.
    """
    try:
        root_token = read_vault_key_file()
        client = VaultHandler(use_vault=True, vault_url=BAO_ADDR, vault_token=root_token, vault_mount_point=f"kv/data/{env}/{app}")

        for key, value in secret_data.items():
            check = client.save_json_secret(key=key, value=value)
            if not check:
                raise Exception(f"Failed to write secret for key: {key}")

        logging.info("Successfully wrote OpenBAO secrets.")
        return True
    except Exception as e:
        logging.error(f"Error writing OpenBAO secret: {e}")
        raise e

def read_bao_secret(env: str, app: str) -> dict:
    """ Read OpenBAO API configuration secrets from the OpenBAO container.
    """

    try:
        root_token = read_vault_key_file()
        client = VaultHandler(use_vault=True, vault_url=BAO_ADDR, vault_token=root_token, vault_mount_point=f"kv/data/{env}/{app}")
        
        app_mapping = {
            "aiforce": OpenBAOAIForceBearerTokenConfig,
            "llm": OpenBAOAzureLLMConfig
        }
        model_class = app_mapping.get(app)
               
        keys = list(model_class.model_fields.keys())
        secret_data = {}
        for key in keys:
            value = client.get_json_secret(key=key)
            if value is not None:
                secret_data[key] = value

        return secret_data

    except Exception as e:
        logging.error(f"Error reading secret for {env}/{app}: {e}")
        return None