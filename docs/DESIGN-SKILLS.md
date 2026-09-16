# Thumbnail design skills

These are built-in, editable design workflows, not downloaded agent plugins or new image models. Open **Skills**, choose a workflow, add your video idea, and click **Copy prompt**. Attach relevant images in ChatGPT, paste the prompt, review it, and send it yourself.

| Skill                    | Job                                                                     |
| ------------------------ | ----------------------------------------------------------------------- |
| Find the hook            | Develop three truthful reasons to click and recommend a visual concept. |
| Remix a reference        | Analyze attached references and create an original adaptation.          |
| Build the composition    | Specify subject hierarchy, layout, framing, and negative space.         |
| Write thumbnail text     | Propose short text that adds to the title instead of repeating it.      |
| Fix color & contrast     | Improve tonal hierarchy and subject separation.                         |
| Direct the expression    | Plan a natural portrait, eyeline, crop, and lighting.                   |
| Spotlight a product      | Feature a real object or interface accurately and clearly.              |
| Show the transformation  | Communicate a supported before-and-after fairly.                        |
| Design without a face    | Tell the story through objects, scale, and environment.                 |
| Explore three directions | Create distinct visual hypotheses and a comparison plan.                |
| Check the small version  | Diagnose readability at reduced thumbnail sizes.                        |
| Give it a final pass     | Review accuracy, typography, edges, artifacts, and export readiness.    |

The workflow definitions live in `skills/<id>/SKILL.md`. `skills/catalog.json` controls titles, categories, and descriptions in the app. Each generated prompt combines the selected workflow, your literal brief, and shared thumbnail guidelines. The brief is limited to 2,400 characters and persists locally between app sessions.

The skills request original compositions, truthful video promises, and real inspection of supplied assets. They do not guarantee click-through rates or claim to generate images without an image tool. ChatGPT's response and generation capabilities depend on your account and current service availability. Thumbnail Studio does not automatically read the conversation, submit prompts, or upload reference files.
