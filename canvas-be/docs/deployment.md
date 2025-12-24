# 1. Build Python Docker Image
1. Create a `Dockerfile` in your project directory with the following content:
    ``` Dockerfile
    # Use an official lightweight Python image
    # ---------- Builder ----------
    FROM python:3.12-slim AS builder

    # Set a working directory
    WORKDIR /app
    
    # Install OS dependencies (optional)
    RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential gcc \
    && rm -rf /var/lib/apt/lists/*
    
    # Install deps separately for caching
    COPY requirements.txt .
    RUN python -m pip install --upgrade pip \
    && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

    # ---------- Runtime ----------
    FROM python:3.12-slim AS runtime

    # Good defaults for containers
    ENV PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1
        
    # Set a working directory
    WORKDIR /app

    # Install wheels from builder
    COPY --from=builder /wheels /wheels
    RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

    # Copy application code
    COPY . /app

    # Optional: document port (K8s doesn't require EXPOSE)
    EXPOSE 8010 

    # For FastAPI (main.py with app=FastAPI()):
    CMD ["python", "main.py", "8010"]
    ```
2. Build the Docker image:
    ```bash
    docker build -t canvas-be:latest .
    ```

3. Verify the image is built:
    ```bash
    docker images | grep canvas-be
    ```

# 2. Deploy Docker Container in minikube cluster
Ensure you have minikube installed. If not, follow the instructions at https://minikube.sigs.k8s.io/docs/start/.
1. Optionally, stop and delete any existing minikube cluster to start fresh:
    ```bash
    minikube stop || true
    minikube delete --all --purge
    ```

2. Start minikube if not already running:
    ```bash
    minikube start
    ```

3. Check minikube status:
    ```bash
    minikube status
    ```
    Output should indicate that the cluster is running.
    ``` text
    minikube
    type: Control Plane
    host: Running
    kubelet: Running
    apiserver: Running
    kubeconfig: Configured
    ```

4. Verify minikube nodes:
    ``` bash
    kubectl get nodes -o wide
    ```

5. Verify minikube pods:
    ``` bash
    kubectl get pods -A
    ```

6. Load the Docker image into minikube:
    ```bash
    minikube image load canvas-be:latest
    ```

7. Verify the image is loaded:
    ```bash
    minikube image ls
    ```

8. Create a Kubernetes secret for environment variables:
    ```bash
    kubectl create secret generic canvas-be-env \
        --from-env-file=.env \
        --dry-run=client -o yaml | kubectl apply -f -
    ```
    Output should confirm the secret creation:
    ``` text
    secret/canvas-be-env created
    ```

9. Apply the deployment configuration:
    ```bash
    kubectl apply -f deployment.yaml
    ```
    Output should confirm the deployment creation:
    ``` text
    deployment.apps/canvas-be-deployment created
    ```

10. Verify the deployment:
    ```bash
    kubectl get deployments
    ```
    Output should show the deployment status:
    ``` text
    NAME                    READY   UP-TO-DATE   AVAILABLE   AGE
    canvas-be-deployment    1/1     1            1           1m
    ```

11. Rollout status:
    ```bash
    kubectl rollout status deployment/canvas-be-deployment
    ```
    Output should indicate a successful rollout:
    ``` text
    deployment "canvas-be-deployment" successfully rolled out
    ```

12. Verify the running pods:
    ```bash
    kubectl get pods
    ```
    Output should show the pod status:
    ``` text
    NAME                                    READY   STATUS    RESTARTS   AGE
    canvas-be-deployment-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
    ```
13. Get kubernetes services
    ```bash
    kubectl get services
    ```
    Output should show the services:
    ``` text
    NAME                   TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
    canvas-be-service      ClusterIP   10.96.XXX.XXX   <none>        8010/TCP         2m
    ```

14. Create service.yaml file with the following content:
    ``` yaml
    apiVersion: v1
    kind: Service
    metadata:
      name: canvas-be-service
    spec:
      selector:
        app: canvas-be
      ports:
        - protocol: TCP
          port: 8010
          targetPort: 8010
      type: ClusterIP
    ```
15. Apply the service configuration:
    ```bash
    kubectl apply -f service.yaml
    ```
    Output should confirm the service creation:
    ``` text
    service/canvas-be-service created
    ```

16. Verify the service:
    ```bash
    kubectl get services
    ```
    Output should show the service status:
    ``` text
    NAME                   TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
    canvas-be-service      ClusterIP   10.96.XXX.XXX   <none>        8010/TCP         1m
    ```

17. Get service url
    ```bash
    minikube service canvas-be-service --url
    ```
    Output should show the service URL:
    ``` text
    http://192.168.X.X:XXXXX
    ```