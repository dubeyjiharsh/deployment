from fastapi import APIRouter, HTTPException
from utils.aiforce_utils import check_aiforce_health
from keys.bao_store import write_bao_secret
from services.responses_service import ResponsesService
from config import settings
from models.schemas import OpenBAOAIForceLLMConfig, OpenBAOAIForceBearerTokenConfig, OpenBAOAzureLLMConfig
from openai import OpenAI
from typing import Dict, Any
from services.file_service import FileService
import logging, requests
import openai
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/openbao", tags=["OpenBao Secret Management"])

    
@router.post("/configure/aiforce")
async def configure_aiforce(secret_data: OpenBAOAIForceBearerTokenConfig):
    '''
    Configure AI Force bearer token in OpenBAO
    '''

    headers = {
		"Authorization": f"Bearer {secret_data.bearer_token}",
		"Content-Type": "application/json"
	}

    try:
        # health check
        status = check_aiforce_health()
        if status != "ok":
            raise HTTPException(
                status_code=503,
                detail="AI Force Platform Management services are down."
            )
        
        # check validity of token via AI Force GCS
        url = settings.AIFORCE_PMS+"/users/list_user?page_number=1&page_size=1"
        response = requests.get(url=url, headers=headers)
        if response.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="Expired token."
            )
        elif response.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="Invalid token."
            )

        # make secret data JSON serializable
        secret_data = secret_data.model_dump()
        result = write_bao_secret(secret_data, env="canvas", app="aiforce")
        logging.info("Successfully wrote AI Force configuration to OpenBAO.")
        if result:
            return JSONResponse(
                status_code=200,
                content={
                "status": "success",
                "message": "AI Force config details saved successfully!",
                }
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to write AI Force config details to OpenBAO."
            )
    except HTTPException as http_exc:
        status_code = http_exc.status_code
        error_detail = http_exc.detail
        raise HTTPException(status_code=status_code, detail=error_detail)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed operation: {str(e)}"
        ) 
    
@router.post("/configure/llm")
async def configure_llm(secret_data: OpenBAOAIForceLLMConfig):
    '''
    Configure Azure OpenAI API configuration in OpenBAO
    '''
    try:
        # Unpack union root
        config = secret_data.root

        # Only validate for Azure config
        if isinstance(config, OpenBAOAzureLLMConfig):
            try:
                client = OpenAI(
                    base_url=config.azure_openai_endpoint.rstrip('/') + "/openai/v1/",
                    api_key=config.azure_openai_api_key,
                    default_query={"api_version": config.azure_openai_api_version}
                )
                response = client.responses.create(
                    model=config.azure_openai_deployment_name,
                    instructions="hi",
                    input=[{"role": "user", "content": [{"type": "input_text", "text": "hi"}]}]
                )
                if not response or not hasattr(response, "output_text"):
                    raise Exception("No response from Azure OpenAI.")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Azure OpenAI credentials." + str(e)
                )
            
        secret_data = secret_data.model_dump()
        result = write_bao_secret(secret_data, env="canvas", app="llm")
        logging.info("Reloaded service clients with new OpenBao configuration.")
        if result:
            ResponsesService.reload_client()
            FileService.reload_client()
            return JSONResponse(
                status_code=200,
                content={
                "status": "success",
                "message": "API config details saved successfully!",
                }
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to write API config details to OpenBAO."
            )
    except HTTPException as http_exc:
        status_code = http_exc.status_code
        error_detail = http_exc.detail
        raise HTTPException(status_code=status_code, detail=error_detail)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed operation {str(e)}"
        )
   

