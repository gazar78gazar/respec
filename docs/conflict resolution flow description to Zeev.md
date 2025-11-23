### Definitions

** Stateful agent
is an LLM call with access to tools, system lists and memory elements.

** System Memory resources 
- time-stamped input output logs of the chatbox and Form
- conflict, unmapped lists
- MAPPED, RESPEC artifacts

** Conflict lists
   receives conflicted data nodes
   each conflicted data node which might conflict several data nodes. hint: in UC8 if all children are conflicted to a certain datanode, their parent inherits the conflict to the data node
   pear each conflict is logs its progress along the following steps: conflict entered-->conflict sent to Stateful agent-->conflict sent as question to user-->conflict answered by user-->conflict resolution(delete)-->conflict resolution(enter)-->conflict resolution results communicated to user.

** MAPPED artifact
   MAPPED artifact is a staging area where the data nodes undergoe a conflict resolution process. 
   MAPPED artifact is supposed to have same data model/structure as UC8 dataset
   
** RESPEC artifact
   RESPEC artifact is the final area hosting data nodes
   RESPEC artifact data nodes are always fully coherent (conflict - clean)
   each change in RESPEC artifact automatically triggers an update to the Form in the GUI, which is a plain representation of the RESPEC artifact. 
 
** 4 conflict types 
with each of the data nodes that are curretnly in RESPEC artifact
1. inherent mutex in extracted nodes
2. exclusion data node relationship (its an attribute to data nodes in UC8) between any data nodes in mapped and any data node in artifact 
3. [I need to find the documentation detailing it]
4. Exclusions leaving an empty specification group (represented in the form by no available drop down selection items for a specification field).
 




### Event Driven Flow

** trigger event: successful match found.

** steps:
 - Map all associated data nodes loged in 'requires' attribute in UC8. they might also have 'requires'.
 - Copy the original and the associated data nodes(name, excludes) into MAPPED artifact. 
** Trigger event: new data node entry to MAPPED artifact
 - Check each data node copied into MAPPED ARTIFACT for all conflict types
 - Conflict found - move data node from MAPPED to a conflict log along with the identified conflicting data nodes.
** Trigger event: new data node entry to conflict log
	Conflict handling pipeline:
	- conflicted data nodes are sent to the stateful agent
	- the stateful agent uses them to curate a binary question in a fixed format and sends it to the user via the chat box
	- user answers the binary question
	- stateful agent receives user answer to question, calls conflict resolution method which
		- Deletes un-selected data nodes (removal may occur from either RESPEC artiafct or conflict log)
		- enters selected data nodes into RESPEC artifact

 
 


 
   
   

