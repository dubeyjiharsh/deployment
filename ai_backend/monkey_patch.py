import requests
from urllib3.exceptions import InsecureRequestWarning
from requests.sessions import Session

# Suppress only the single InsecureRequestWarning from urllib3
requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)

def patch_requests_ssl():
    """
    Monkey patch the requests.Session to disable SSL verification globally.
    Use this ONLY in development/testing environments.
    """
    original_merge = Session.merge_environment_settings

    def merge_environment_settings_no_verify(self, url, proxies, stream, verify, cert):
        # Force SSL verification off
        verify = False
        return original_merge(self, url, proxies, stream, verify, cert)

    Session.merge_environment_settings = merge_environment_settings_no_verify
    print("[!] Requests SSL verification disabled (Monkey Patch Active)")
