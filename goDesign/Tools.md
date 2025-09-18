refer to doc for new transition type 'Tools' added at server side, #file:TEST-toolsnode.md #file:llm-mcp-yf-demo.json #file:llm-tools-ddg.json #file:llm-react.json , add UI support:
1. allow user to create new Tools transition, for example, right click to change a transitiom type to Tools
2. refer to sample cpn tools transitions, tools transition's property panel should allow users to add an array of tools, either built-in tools or mcp tools registered
3. registered mcp tools can be fetched from "/api/tools/list_mcp_tools"
4. built in tools include duckduckgo, wikipedia now, the list of built in tools is to be fetched from server in future.
5. tools transitiom property panel contains only properties of id, name, array of tools.
6. each of tool contain string name and a json 'config' object
7. the array of tools can be rendered using accordin at property panel