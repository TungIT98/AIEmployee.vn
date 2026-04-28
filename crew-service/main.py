"""
CrewAI FastAPI Service
Provides multi-agent orchestration via CrewAI
"""
import os
import asyncio
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette import EventSourceResponse
from dotenv import load_dotenv

load_dotenv()

# Import crew definitions
from crews.content_crew import ContentCrew
from crews.support_crew import SupportCrew
from crews.sales_crew import SalesCrew
from crews.data_analysis_crew import DataAnalysisCrew

# Crew registry
CREW_REGISTRY = {
    "content": ContentCrew,
    "support": SupportCrew,
    "sales": SalesCrew,
    "data_analysis": DataAnalysisCrew,
}


class CrewInput(BaseModel):
    """Input for running a crew"""
    task: str = Field(..., description="The task to assign to the crew")
    inputs: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional inputs for agents")
    streaming: bool = Field(default=True, description="Enable SSE streaming")


class CrewOutput(BaseModel):
    """Output from a crew execution"""
    crew_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_seconds: Optional[float] = None


# In-memory storage for crew executions
crew_executions: Dict[str, Dict[str, Any]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    print("CrewAI Service starting up...")
    yield
    print("CrewAI Service shutting down...")


app = FastAPI(
    title="CrewAI Service",
    description="Multi-agent orchestration service powered by CrewAI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "crewai-service",
        "timestamp": datetime.utcnow().isoformat(),
        "available_crews": list(CREW_REGISTRY.keys())
    }


@app.get("/crews")
async def list_crews():
    """List all available crews"""
    return {
        "crews": [
            {
                "id": crew_id,
                "name": crew.__name__,
                "description": getattr(crew, 'description', 'No description')
            }
            for crew_id, crew in CREW_REGISTRY.items()
        ]
    }


@app.post("/crews/{crew_id}/run")
async def run_crew(
    crew_id: str,
    input_data: CrewInput,
    background_tasks: BackgroundTasks
):
    """
    Run a crew with the given task.
    Returns immediately with execution ID for streaming.
    """
    if crew_id not in CREW_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Crew '{crew_id}' not found")

    execution_id = f"exec_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{crew_id}"

    # Store execution state
    crew_executions[execution_id] = {
        "crew_id": crew_id,
        "status": "pending",
        "task": input_data.task,
        "inputs": input_data.inputs,
        "started_at": datetime.utcnow().isoformat(),
        "result": None,
        "error": None
    }

    # Run crew in background
    background_tasks.add_task(execute_crew, execution_id, crew_id, input_data)

    return {
        "execution_id": execution_id,
        "status": "started",
        "stream_url": f"/crews/{crew_id}/stream/{execution_id}"
    }


@app.get("/crews/{crew_id}/stream/{execution_id}")
async def stream_crew_results(crew_id: str, execution_id: str):
    """SSE endpoint for streaming crew execution results"""
    if execution_id not in crew_executions:
        raise HTTPException(status_code=404, detail="Execution not found")

    async def event_generator():
        execution = crew_executions[execution_id]

        # Send initial status
        yield {
            "event": "status",
            "data": json.dumps({
                "execution_id": execution_id,
                "status": "started",
                "message": f"Crew '{crew_id}' execution started"
            })
        }

        # Poll for updates while running
        while execution["status"] in ["pending", "running"]:
            await asyncio.sleep(0.5)
            if execution_id not in crew_executions:
                break

            yield {
                "event": "heartbeat",
                "data": json.dumps({
                    "execution_id": execution_id,
                    "status": execution["status"]
                })
            }

        # Send final result
        if execution_id in crew_executions:
            execution = crew_executions[execution_id]
            yield {
                "event": "complete",
                "data": json.dumps({
                    "execution_id": execution_id,
                    "status": execution["status"],
                    "result": execution.get("result"),
                    "error": execution.get("error"),
                    "finished_at": datetime.utcnow().isoformat()
                })
            }

    return EventSourceResponse(event_generator())


@app.get("/crews/{crew_id}/status/{execution_id}")
async def get_execution_status(crew_id: str, execution_id: str):
    """Get status of a crew execution"""
    if execution_id not in crew_executions:
        raise HTTPException(status_code=404, detail="Execution not found")

    execution = crew_executions[execution_id]
    return {
        "execution_id": execution_id,
        "crew_id": execution["crew_id"],
        "status": execution["status"],
        "result": execution.get("result"),
        "error": execution.get("error"),
        "started_at": execution.get("started_at")
    }


async def execute_crew(execution_id: str, crew_id: str, input_data: CrewInput):
    """Execute a crew in the background"""
    import time
    start_time = time.time()

    try:
        crew_executions[execution_id]["status"] = "running"

        # Get the crew class
        CrewClass = CREW_REGISTRY[crew_id]

        # Create and execute crew
        crew = CrewClass()

        # Prepare inputs
        inputs = {
            "task": input_data.task,
            **input_data.inputs
        }

        # Execute with streaming callback
        result = crew.execute_with_streaming(inputs)

        crew_executions[execution_id]["status"] = "completed"
        crew_executions[execution_id]["result"] = result
        crew_executions[execution_id]["duration_seconds"] = time.time() - start_time

    except Exception as e:
        crew_executions[execution_id]["status"] = "failed"
        crew_executions[execution_id]["error"] = str(e)
        crew_executions[execution_id]["duration_seconds"] = time.time() - start_time


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CREW_SERVICE_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
