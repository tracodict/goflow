# Petri Flow Views

This document outlines the Views defined in the Petri Flow system, along with their detailed schemas.

## Workflow Views

### WorkflowIndexView

Displays a list of workflows.

```ruby
class WorkflowIndexView < ApplicationView
  def initialize(workflows:)
    @workflows = workflows
  end

  def template
    table do
      thead do
        tr do
          th { "Name" }
          th { "Description" }
          th { "Version" }
          th { "Actions" }
        end
      end
      tbody do
        @workflows.each do |workflow|
          tr do
            td { workflow.name }
            td { workflow.description }
            td { workflow.version }
            td do
              link_to "Edit", edit_workflow_path(workflow)
              link_to "Delete", workflow_path(workflow), method: :delete, data: { confirm: "Are you sure?" }
            end
          end
        end
      end
    end
  end
end
```

### WorkflowShowView

Displays details of a specific workflow.

```ruby
class WorkflowShowView < ApplicationView
  def initialize(workflow:)
    @workflow = workflow
  end

  def template
    div do
      h1 { @workflow.name }
      p { @workflow.description }
      p { "Version: #{@workflow.version}" }
      
      h2 { "Places" }
      ul do
        @workflow.places.each do |place|
          li { "#{place.name} (Initial marking: #{place.initial_marking})" }
        end
      end

      h2 { "Transitions" }
      ul do
        @workflow.transitions.each do |transition|
          li { transition.name }
        end
      end

      h2 { "Arcs" }
      ul do
        @workflow.arcs.each do |arc|
          li { "#{arc.source.name} -> #{arc.target.name}" }
        end
      end
    end
  end
end
```

## Case Views

### CaseIndexView

Displays a list of cases for a specific workflow.

```ruby
class CaseIndexView < ApplicationView
  def initialize(workflow:, cases:)
    @workflow = workflow
    @cases = cases
  end

  def template
    h1 { "Cases for #{@workflow.name}" }
    table do
      thead do
        tr do
          th { "ID" }
          th { "Status" }
          th { "Created At" }
          th { "Actions" }
        end
      end
      tbody do
        @cases.each do |case_item|
          tr do
            td { case_item.id }
            td { case_item.status }
            td { case_item.created_at.to_s }
            td do
              link_to "View", case_path(case_item)
            end
          end
        end
      end
    end
  end
end
```

### CaseShowView

Displays details of a specific case.

```ruby
class CaseShowView < ApplicationView
  def initialize(case_item:)
    @case_item = case_item
  end

  def template
    div do
      h1 { "Case #{@case_item.id}" }
      p { "Status: #{@case_item.status}" }
      p { "Created At: #{@case_item.created_at}" }
      
      h2 { "Current Marking" }
      ul do
        @case_item.current_marking.each do |place, tokens|
          li { "#{place.name}: #{tokens} tokens" }
        end
      end

      h2 { "Variables" }
      table do
        thead do
          tr do
            th { "Name" }
            th { "Value" }
          end
        end
        tbody do
          @case_item.variables.each do |name, value|
            tr do
              td { name }
              td { value.to_s }
            end
          end
        end
      end

      h2 { "History" }
      ul do
        @case_item.history.each do |event|
          li { "#{event.timestamp}: #{event.action}" }
        end
      end
    end
  end
end
```

## Token Views

### TokenIndexView

Displays a list of tokens for a specific case.

```ruby
class TokenIndexView < ApplicationView
  def initialize(case_item:, tokens:)
    @case_item = case_item
    @tokens = tokens
  end

  def template
    h1 { "Tokens for Case #{@case_item.id}" }
    table do
      thead do
        tr do
          th { "ID" }
          th { "Place" }
          th { "Color" }
          th { "Created At" }
        end
      end
      tbody do
        @tokens.each do |token|
          tr do
            td { token.id }
            td { token.place.name }
            td { token.color }
            td { token.created_at.to_s }
          end
        end
      end
    end
  end
end
```
