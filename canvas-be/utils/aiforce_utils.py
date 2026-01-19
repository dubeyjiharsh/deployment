import requests

def check_aiforce_health() -> str:
    """
    Calls the aiforce health endpoint and returns the status string.
    """
    try:
        response = requests.get("https://aiforce.hcltech.com/check_health")
        if response.status_code == 200:
            data = response.json()
            return data.get("status", "unknown")
        else:
            return "unhealthy"
    except Exception:
        return "unhealthy"