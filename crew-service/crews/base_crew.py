"""
Base Crew class with common functionality
"""
from crewai import Agent, Crew, Process, Task
from typing import Dict, Any, Callable, Optional
import json


class BaseCrew:
    """Base class for all crews with common execution logic"""

    agents: list[Agent] = []
    tasks: list[Task] = []
    description: str = "Base crew"

    def __init__(self):
        self._crew = None
        self._callbacks = []

    def add_callback(self, callback: Callable):
        """Add a callback for streaming updates"""
        self._callbacks.append(callback)

    def _notify_callbacks(self, event: str, data: Dict[str, Any]):
        """Notify all registered callbacks"""
        for callback in self._callbacks:
            try:
                callback(event, data)
            except Exception:
                pass  # Don't let callback errors break execution

    def execute_with_streaming(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the crew with streaming support"""

        # Create crew with kickoff
        self._crew = Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.hierarchical,
            manager_agent=self._get_manager_agent(),
            verbose=True
        )

        # Execute
        result = self._crew.kickoff(inputs=inputs)

        return {
            "result": str(result),
            "tasks_output": [task.output for task in self.tasks] if hasattr(self, 'tasks') else []
        }

    def _get_manager_agent(self):
        """Override in subclass to provide a custom manager agent"""
        return None  # Uses default CrewAI manager

    def execute(self, inputs: Dict[str, Any]) -> str:
        """Simple synchronous execution without streaming"""
        if not self._crew:
            self._crew = Crew(
                agents=self.agents,
                tasks=self.tasks,
                process=Process.hierarchical,
                manager_agent=self._get_manager_agent(),
                verbose=True
            )

        result = self._crew.kickoff(inputs=inputs)
        return str(result)
