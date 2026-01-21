from fastapi import APIRouter, HTTPException, Query
from utils.aiforce_utils import check_aiforce_health
from config import settings
import requests
import os
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/user", tags=["User Validation"])

@router.get("/validate")
def validate_user(user_id: str):
	"""
	Validate a user against the AI Force portal.
    """
	headers = {
		"Authorization": f"Bearer {settings.get_aiforce_config().get('bearer_token', '')}",
		"Content-Type": "application/json"
	}
	payload = {"search_term": user_id}

	try:
		# health check
		status = check_aiforce_health()
		if status != "ok":
			raise HTTPException(status_code=503, detail="AI Force Platform Management services are down.")

		# validate user
		response = requests.get("https://aiforce.hcltech.com/pms/users/list_user", params=payload, headers=headers)
		if response.status_code == 403:
			raise HTTPException(status_code=403, detail="Invalid token")
		elif response.status_code == 401:
			raise HTTPException(status_code=401, detail="Expired token")
		elif response.status_code != 200:
			raise HTTPException(status_code=response.status_code, detail="Failed to validate user")
		
		data = response.json()
		users = data.get("data", {}).get("users", [])
	
		if len(users) == 1:
			return JSONResponse(
				status_code=200,
				content={
					"status": "success",
					"message": f"User '{user_id}' is valid.",
					"details": users[0]
				}
			)
		elif len(users) > 1:
			raise HTTPException(status_code=409, detail=f"Multiple users found for '{user_id}'")
		else:
			raise HTTPException(status_code=404, detail=f"User '{user_id}' not found or invalid.")
	except HTTPException as http_exc:
		status_code = http_exc.status_code
		error_detail = http_exc.detail
		raise HTTPException(status_code=status_code, detail=error_detail)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to validate user: {str(e)}")