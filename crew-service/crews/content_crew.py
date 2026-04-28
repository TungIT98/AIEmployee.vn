"""
Content Crew - Creates marketing content with sequential pipeline
"""
from crewai import Agent, Task
from crewai.tasks import TaskOutput
from crews.base_crew import BaseCrew
from typing import List


class ContentCrew(BaseCrew):
    description = "Creates marketing content including blog posts, social media, and email campaigns"

    def __init__(self):
        super().__init__()

        # Content Strategist Agent - Plans content strategy
        content_strategist = Agent(
            role="Content Strategist",
            goal="Create compelling content strategies that align with brand goals",
            backstory="""You are an expert content strategist with 10+ years of experience
            in digital marketing. You understand what content resonates with audiences
            and how to structure content for maximum engagement.

            You excel at:
            - Audience research and persona development
            - Content gap analysis
            - Topic ideation and content calendar planning
            - Content performance optimization""",
            verbose=True,
            allow_delegation=True
        )

        # Researcher Agent - Gathers information
        researcher = Agent(
            role="Content Researcher",
            goal="Research and gather accurate, up-to-date information on any topic",
            backstory="""You are a thorough researcher who knows how to find credible sources
            and synthesize complex information into digestible facts.

            You excel at:
            - Finding authoritative sources
            - Fact-checking and verification
            - Data gathering and statistics
            - Competitive content analysis""",
            verbose=True,
            allow_delegation=False
        )

        # Writer Agent - Creates content
        writer = Agent(
            role="Content Writer",
            goal="Write engaging, persuasive content that converts readers",
            backstory="""You are a professional content writer specializing in digital marketing
            and blog content. You write clear, compelling copy that engages readers and drives action.

            Your specialties include:
            - SEO-optimized blog posts
            - Marketing emails and newsletters
            - Social media captions
            - Landing page copy
            - Case studies and whitepapers""",
            verbose=True,
            allow_delegation=False
        )

        # Editor Agent - Refines and polishes content
        editor = Agent(
            role="Content Editor",
            goal="Polish and refine content to publication quality",
            backstory="""You are a meticulous editor with a keen eye for detail. You ensure all
            content is error-free, consistent, and ready for publication.

            You excel at:
            - Grammar and style checking
            - Readability optimization
            - Brand voice consistency
            - SEO final review
            - Fact verification""",
            verbose=True,
            allow_delegation=False
        )

        self.agents = [content_strategist, researcher, writer, editor]

        # Define tasks
        self.tasks = self._create_tasks()

    def _create_tasks(self) -> List[Task]:
        """Create the content creation pipeline tasks"""

        # Task 1: Content Strategy
        strategy_task = Task(
            description="""Given a content topic or brief:
            1. Analyze the target audience and their needs
            2. Identify key themes and angles to cover
            3. Determine the optimal content format (blog post, email, social, etc.)
            4. Outline the main points to be covered
            5. Provide SEO keywords and recommendations

            Input: {task}
            Output: A detailed content strategy document""",
            agent=self.agents[0],  # content_strategist
            expected_output="Content strategy document with topic outline, target audience profile, SEO keywords, and content format recommendations"
        )

        # Task 2: Research
        research_task = Task(
            description="""Based on the content strategy:
            1. Research the topic thoroughly using available tools
            2. Gather relevant statistics, facts, and data points
            3. Find credible sources to reference
            4. Identify any gaps or areas needing more depth
            5. Compile research findings in an organized manner

            Context from strategy: {strategy_output}
            Input: {task}
            Output: Research findings document with sources""",
            agent=self.agents[1],  # researcher
            expected_output="Comprehensive research document with facts, statistics, sources, and key insights",
            context=[strategy_task]  # Depends on strategy task
        )

        # Task 3: Writing
        writing_task = Task(
            description="""Based on the content strategy and research:
            1. Write compelling content following the outline
            2. Incorporate research findings naturally
            3. Use engaging headlines and subheadings
            4. Include a clear call-to-action
            5. Optimize for both readers and search engines

            Context from research: {research_output}
            Input: {task}
            Output: Full content piece ready for review""",
            agent=self.agents[2],  # writer
            expected_output="Complete content piece (blog post, email, social content) with headline, body, and call-to-action",
            context=[research_task]  # Depends on research task
        )

        # Task 4: Editing
        editing_task = Task(
            description="""Review and polish the content:
            1. Check for grammar, spelling, and punctuation errors
            2. Ensure consistent tone and brand voice
            3. Verify SEO optimization is maintained
            4. Check readability score and flow
            5. Confirm all facts and sources are accurate
            6. Prepare final version for publication

            Content to edit: {writing_output}
            Output: Publication-ready content""",
            agent=self.agents[3],  # editor
            expected_output="Final polished content ready for publication, with any revision notes",
            context=[writing_task]  # Depends on writing task
        )

        return [strategy_task, research_task, writing_task, editing_task]

    def execute_with_streaming(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the content crew with streaming"""
        from crewai import Crew, Process

        # Create crew with sequential process for content pipeline
        self._crew = Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,  # Sequential for content pipeline
            verbose=True,
            output_log_file="crewai_content_log.txt"
        )

        # Execute
        result = self._crew.kickoff(inputs=inputs)

        return {
            "result": str(result),
            "tasks_output": [
                {
                    "task": task.description[:50] + "...",
                    "output": str(task.output) if hasattr(task, 'output') else None
                }
                for task in self.tasks
            ]
        }
