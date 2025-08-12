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