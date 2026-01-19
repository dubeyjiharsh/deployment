import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { IconKey, IconRobot, IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { getToken } from "@/src/lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function AdminConfigurePage() {
  // Bearer Token State
  const [bearerToken, setBearerToken] = React.useState("");
  const [bearerLoading, setBearerLoading] = React.useState(false);

  // LLM Configuration State
  // const [llmProvider, setLlmProvider] = React.useState("");
  const [llmApiKey, setLlmApiKey] = React.useState("");
  // const [llmModel, setLlmModel] = React.useState("");
  const [apiVersion, setApiVersion] = React.useState("");
  const [endpoint, setEndpoint] = React.useState("");
  const [deploymentName, setDeploymentName] = React.useState("");
  const [llmLoading, setLlmLoading] = React.useState(false);

  // Handle Bearer Token Update
  const handleBearerTokenUpdate = async () => {
    if (!bearerToken.trim()) {
      toast.error("Please enter a bearer token");
      return;
    }

    setBearerLoading(true);
    try {
      const authToken = getToken();
      const response = await axios.post(
        `${API_BASE_URL}/api/openbao/configure/aiforce`,
        {
          bearer_token: bearerToken,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        toast.success("Bearer token updated successfully!", {
          icon: <IconCheck className="h-5 w-5" />,
        });
        setBearerToken("");
      }
    } catch (error: any) {
      console.error("Bearer token update failed:", error);
      toast.error(error.response?.data?.message || "Failed to update bearer token", {
        icon: <IconAlertCircle className="h-5 w-5" />,
      });
    } finally {
      setBearerLoading(false);
    }
  };

  // Handle LLM Configuration Update
  const handleLlmConfigUpdate = async () => {
    if (!llmApiKey.trim() || !apiVersion.trim() || !endpoint.trim() || !deploymentName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLlmLoading(true);
    try {
      const authToken = getToken();
      const response = await axios.post(
        `${API_BASE_URL}/api/openbao/configure/llm`,
        {
          // provider: llmProvider,
          // api_key: llmApiKey,
          // model: llmModel || undefined,
          api_version: apiVersion,
          endpoint: endpoint,
          api_key: llmApiKey,
          deployment_name: deploymentName,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        toast.success("LLM configuration updated successfully!", {
          icon: <IconCheck className="h-5 w-5" />,
        });
        // setLlmProvider("");
        setLlmApiKey("");
        // setLlmModel("");
        setApiVersion("");
        setEndpoint("");
        setDeploymentName("");
      }
    } catch (error: any) {
      console.error("LLM config update failed:", error);
      toast.error(error.response?.data?.message || "Failed to update LLM configuration", {
        icon: <IconAlertCircle className="h-5 w-5" />,
      });
    } finally {
      setLlmLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-blue-500">Admin Configuration</h1>
        {/* <h2 className="text-3xl font-bold tracking-tight">Admin Configuration</h2> */}
      </div>

      <Tabs defaultValue="bearer" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bearer" className="flex items-center gap-2">
            {/* <IconKey className="h-4 w-4" /> */}
            Bearer Token
          </TabsTrigger>
          <TabsTrigger value="llm" className="flex items-center gap-2">
            {/* <IconRobot className="h-4 w-4" /> */}
            LLM Configuration
          </TabsTrigger>
        </TabsList>

        {/* Bearer Token Tab */}
        <TabsContent value="bearer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-500">
                {/* <IconKey className="h-5 w-5" /> */}
                Bearer Token Configuration
              </CardTitle>
              <CardDescription className="text-sm text-blue-500">
                Update the bearer token used for AI Force authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bearer-token">Bearer Token</Label>
                <Input
                  id="bearer-token"
                  type="password"
                  placeholder="Enter new bearer token"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  disabled={bearerLoading}
                />
                
              </div>

              <Button
                onClick={handleBearerTokenUpdate}
                disabled={bearerLoading || !bearerToken.trim()}
                className="w-full sm:w-auto"
              >
                {bearerLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    {/* <IconCheck className="h-4 w-4 mr-2" /> */}
                    Update Bearer Token
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Configuration Tab */}
        <TabsContent value="llm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-500">
                {/* <IconRobot className="h-5 w-5" /> */}
                LLM API Configuration
              </CardTitle>
              <CardDescription className="text-sm text-blue-500">
                Configure the Language Model provider and credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* <div className="space-y-2">
                <Label htmlFor="llm-provider">LLM Provider</Label>
                <Input
                  id="llm-provider"
                  placeholder="e.g., OpenAI, Anthropic, Azure"
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  disabled={llmLoading}
                />
              </div> */}

              <div className="space-y-2">
                <Label htmlFor="llm-api-key">API Key</Label>
                <Input
                  id="llm-api-key"
                  type="password"
                  placeholder="Enter LLM API key"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  disabled={llmLoading}
                />
              </div>

              {/* <div className="space-y-2">
                <Label htmlFor="llm-model">Model (Optional)</Label>
                <Input
                  id="llm-model"
                  placeholder="e.g., gpt-4, claude-3-opus"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  disabled={llmLoading}
                />
                
              </div> */}

              <div className="space-y-2">
                <Label htmlFor="api-version">API Version</Label>
                <Input
                  id="api-version"
                  placeholder="Enter API version"
                  value={apiVersion}
                  onChange={(e) => setApiVersion(e.target.value)}
                  disabled={llmLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endpoint">Endpoint</Label>
                <Input
                  id="endpoint"
                  placeholder="Enter endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  disabled={llmLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deployment-name">Deployment Name</Label>
                <Input
                  id="deployment-name"
                  placeholder="Enter deployment name"
                  value={deploymentName}
                  onChange={(e) => setDeploymentName(e.target.value)}
                  disabled={llmLoading}
                />
              </div>

              <Button
                onClick={handleLlmConfigUpdate}
                disabled={llmLoading || !llmApiKey.trim()}
                className="w-full sm:w-auto"
              >
                {llmLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    {/* <IconCheck className="h-4 w-4 mr-2" /> */}
                    Update LLM Configuration
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Information Card */}
      {/* <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <IconAlertCircle className="h-5 w-5" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2">
          <p className="text-sm">
            • Configuration changes affect all users in the system
          </p>
          <p className="text-sm">
            • Ensure credentials are valid before updating
          </p>
          <p className="text-sm">
            • Changes take effect immediately after update
          </p>
          <p className="text-sm">
            • Keep your API keys secure and never share them
          </p>
        </CardContent>
      </Card> */}
    </div>
  );
}