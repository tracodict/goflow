## Subflow

Refer to design at #file:rubyDesign of petri nets based workflow engine design and revamp design using go at #file:goDesign and current implementation at #file:app and #file:components , refer to execution plan at #file:Plan.md . Now enhance the UI so that left side panel of Monitor would support multiple tabs in the side panel:

existing Monitor
new Explorer
Explorer tab would show a file explorer alike UI.

A folder means a workflow
there are four item types in workflow folder
a. places
b. transitions
c. arcs
d. sub folders which are sub petri nets representing sub workflow
places can be expanded to a list all places defined in current workflow represented by the places' parent folder
transitions can be expanded to a list transitions of current workflow represented by the transitions' parent folder
arcs can be expanded to a list arcs of current workflow represented by the arcs' parent folder
maintain a mockup workflow store to keep all defined workflows, until hooking up the UI to real API backend
add a workflow type of transition, and workflow type transition properties include a reference to another workflow definition.
when expand a sub-workflow, the explorer side panel would show items defined by the referred sub-workflow



enhance and revamp #file:main.tsx:
1. add tiny header menu bar
2. at left most side the menu bar, there is a button to open or close left side bar
3. when left side bar is closed, the icon use lucide `panel-left-open`, otherwise, use icon `panel-left-close`
4. implement left side bar
5. there is a tiny header bar at left side bar, with title `Cases` at left side, and 
6. at rgiht most corner, there is lucide `plus` icon to create/add a new case from workflow id, when user click the `plus` button, there should be a grid of cards display at bottom of main panel, that list all workflows defined, with their name and description
7. when user click a workflow card, a new case should be created. be noted, existing implementation uses network APIs. Now revamp  to use case based APIs
8. left panel should list cases created, with default title of `workflow name` + random suffix like `#s4z`, and allow user to edit
9. when user click different case title at left panel, the context switch to that case, e.g., `anyEnabled` variable should indicate whether select case has any enabled transition and get the message square (dot) floating button update status.