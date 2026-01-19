
import os
import hvac
import logging
from dotenv import load_dotenv

load_dotenv()

BAO_ADDR = os.getenv("OPENBAO_ADDR")
READ_ROLE_ID  = os.getenv("BAO_READ_ROLE_ID")
READ_SECRET_ID = os.getenv("BAO_READ_SECRET_ID")
WRITE_ROLE_ID = os.getenv("BAO_WRITE_ROLE_ID")
WRITE_SECRET_ID = os.getenv("BAO_WRITE_SECRET_ID")

def write_bao_secret(secret_data: dict, env: str, app: str) -> bool:
    """
    Write OpenBAO API configuration secrets to the OpenBAO container.
    Accepts a dictionary containing the secret data.
    """
    try:
        client = hvac.Client(url=BAO_ADDR)

        # raise HTTPException if bao container is sealed
        if client.sys.is_sealed():
            raise Exception("OpenBAO is sealed. Cannot write secrets.")
        
        client.auth.approle.login(role_id=WRITE_ROLE_ID, secret_id=WRITE_SECRET_ID)
        client.secrets.kv.v2.create_or_update_secret(
            mount_point="secret",
            path=f"azureopenai/{env}/{app}",
            secret=secret_data,
        )
        logging.info("Successfully wrote OpenBAO secrets.")
        return True
    except Exception as e:
        logging.error(f"Error writing OpenBAO secret: {e}")
        raise e

def read_bao_secret(env: str, app: str) -> dict:
    """ Read OpenBAO API configuration secrets from the OpenBAO container.
    """

    try:
        client = hvac.Client(url=BAO_ADDR)
        if client.sys.is_sealed():
            raise Exception("OpenBAO is sealed. Cannot fetch details. Contact your openbao administrator.")
        client.auth.approle.login(role_id=READ_ROLE_ID, secret_id=READ_SECRET_ID)
        resp = client.secrets.kv.v2.read_secret_version(
            mount_point="secret",
            path=f"azureopenai/{env}/{app}"
        )

        return resp["data"]["data"]
    except Exception as e:
        logging.error(f"Error reading secret for {env}/{app}: {e}")
        return None