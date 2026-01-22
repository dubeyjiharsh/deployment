import requests
from config import settings

def check_aiforce_health() -> str:
    """
    Calls the aiforce health endpoint and returns the status string.
    """
    try:
        url = settings.AIFORCE_HEALTH_CHECK+"/check_health"
        response = requests.get(url=url)
        if response.status_code == 200:
            data = response.json()
            return data.get("status", "unknown")
        else:
            return "unhealthy"
    except Exception:
        return "unhealthy"