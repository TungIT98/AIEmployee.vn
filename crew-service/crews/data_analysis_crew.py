"""
Data Analysis Crew - Analyzes data and generates insights
"""
from crewai import Agent
from crews.base_crew import BaseCrew


class DataAnalysisCrew(BaseCrew):
    description = "Analyzes data and generates actionable business insights"

    def __init__(self):
        super().__init__()

        # Data Analysis Manager
        analysis_manager = Agent(
            role="Data Analysis Manager",
            goal="Coordinate data analysis efforts and deliver actionable insights",
            backstory="""You are an experienced data analyst who leads a team of specialists.
            You know how to structure analysis projects and present findings to stakeholders.""",
            verbose=True,
            allow_delegation=True
        )

        # Data Engineer Agent
        data_engineer = Agent(
            role="Data Engineer",
            goal="Prepare and transform data for analysis",
            backstory="""You are a data engineering expert who can clean, transform,
            and prepare data for analysis. You ensure data quality and consistency.""",
            verbose=True,
            allow_delegation=False
        )

        # Business Analyst Agent
        business_analyst = Agent(
            role="Business Analyst",
            goal="Generate insights that drive business decisions",
            backstory="""You are a business analyst who bridges the gap between data
            and business strategy. You translate numbers into actionable recommendations.""",
            verbose=True,
            allow_delegation=False
        )

        self.agents = [analysis_manager, data_engineer, business_analyst]

    def _get_manager_agent(self):
        """Data analysis crew uses analysis_manager as manager"""
        return self.agents[0]
