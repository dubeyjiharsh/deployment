from fastapi import APIRouter, HTTPException
from utils.aiforce_utils import check_aiforce_health
from keys.bao_store import write_bao_secret
from services.responses_service import ResponsesService
from models.schemas import OpenBAOAIForceLLMConfig, OpenBAOAIForceBearerTokenConfig
from typing import Dict, Any
from services.file_service import FileService
import logging, requests
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
        response = requests.get("https://aiforce.hcltech.com/gcs/register/protected-resource", headers=headers)
        if response.status_code != 200:
            raise HTTPException(
                status_code=401,
                detail="Invalid AI Force bearer token."
            )

        # make secret data JSON serializable
        secret_data = secret_data.model_dump()
        result = write_bao_secret(secret_data, env="dev", app="aiforce")
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
        secret_data = secret_data.model_dump()
        result = write_bao_secret(secret_data, env="dev", app="llm")
        
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
   

