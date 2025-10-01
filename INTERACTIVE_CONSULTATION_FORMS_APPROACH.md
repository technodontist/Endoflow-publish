# Interactive Consultation Forms - Implementation Approach

## Overview
This document outlines the successful approach used to create interactive consultation forms that are basic, functional, and production-ready.

## Key Principles
1. **Keep it Simple** - Basic but functional forms
2. **No Duplication** - Avoid repeating elements across tabs (e.g., pain assessment)
3. **Clean UI** - Professional, minimal interface
4. **State Management** - Simple local state with parent callbacks

## Implementation Pattern

### 1. Component Structure
```tsx
export function TabName({ data, onChange, isReadOnly = false, onSave }: any) {
  // Local state management
  const [field1, setField1] = useState('')
  const [field2, setField2] = useState('')
  
  // Event handlers
  const handleField1Change = (value: string) => {
    setField1(value)
    if (onChange) {
      onChange({
        field1: value,
        field2: field2,
        // ... other fields
      })
    }
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Tab Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form fields */}
        </CardContent>
      </Card>
    </div>
  )
}
```

### 2. Form Field Types & Best Practices

#### Text Input
```tsx
<div>
  <Label htmlFor="field-id">Field Label</Label>
  <Input
    id="field-id"
    value={fieldValue}
    onChange={(e) => handleFieldChange(e.target.value)}
    placeholder="Helpful placeholder text"
    disabled={isReadOnly}
    className="mt-2"
  />
</div>
```

#### Textarea
```tsx
<div>
  <Label htmlFor="field-id">Field Label</Label>
  <Textarea
    id="field-id"
    value={fieldValue}
    onChange={(e) => handleFieldChange(e.target.value)}
    placeholder="Detailed placeholder text..."
    rows={4}
    disabled={isReadOnly}
    className="mt-2"
  />
</div>
```

#### Range Slider (Only use if not in Chief Complaint)
```tsx
<div>
  <Label htmlFor="field-id">Label: {value}/10</Label>
  <input
    id="field-id"
    type="range"
    min="0"
    max="10"
    value={value}
    onChange={(e) => handleChange(parseInt(e.target.value))}
    disabled={isReadOnly}
    className="w-full mt-2 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
  />
  <div className="flex justify-between text-xs text-gray-500 mt-1">
    <span>Min label</span>
    <span>Max label</span>
  </div>
</div>
```

#### Checkboxes
```tsx
<div>
  <Label>Group Label</Label>
  <div className="grid grid-cols-2 gap-3 mt-2">
    {options.map(option => (
      <div key={option} className="flex items-center space-x-2">
        <Checkbox
          id={`option-${option}`}
          checked={selectedOptions.includes(option)}
          onCheckedChange={() => handleToggle(option)}
          disabled={isReadOnly}
        />
        <Label htmlFor={`option-${option}`} className="text-sm cursor-pointer">
          {option}
        </Label>
      </div>
    ))}
  </div>
</div>
```

#### Save Button Pattern
```tsx
{!isReadOnly && onSave && (
  <div className="pt-4 border-t">
    <Button 
      onClick={() => {
        if (onSave) {
          onSave({
            field1: field1,
            field2: field2,
            // ... all fields
          })
        }
      }}
      className="bg-teal-600 hover:bg-teal-700 text-white"
    >
      Save
    </Button>
  </div>
)}
```

### 3. State Management Pattern

#### Local State
```tsx
const [field1, setField1] = useState('')
const [field2, setField2] = useState(0)
const [field3, setField3] = useState<string[]>([])
```

#### Event Handlers
```tsx
const handleFieldChange = (value: string) => {
  setField(value)
  if (onChange) {
    onChange({
      field1: value,
      field2: field2,
      field3: field3,
      // Include all fields in every onChange call
    })
  }
}
```

### 4. Styling Guidelines

#### Colors
- Primary: `text-teal-600` for titles
- Buttons: `bg-teal-600 hover:bg-teal-700 text-white`
- Labels: Default text color
- Placeholders: Helpful, professional text

#### Layout
- Container: `space-y-6`
- Cards: Standard Card, CardHeader, CardContent
- Form sections: `space-y-6` inside CardContent
- Field spacing: `mt-2` for inputs below labels

#### Accessibility
- Always include `htmlFor` and `id` attributes
- Use `cursor-pointer` on checkbox labels
- Proper `disabled` state handling

### 5. Field Distribution Guidelines

#### Chief Complaint Tab
- Primary complaint (text)
- Detailed description (textarea)  
- Pain level (slider 0-10)
- Associated symptoms (checkboxes)

#### HOPI Tab (No duplication with Chief Complaint)
- Onset details (text/select)
- Duration (text)
- Aggravating factors (checkboxes)
- Relieving factors (checkboxes)
- Previous episodes (textarea)
- Previous treatments (checkboxes)

#### Other Tabs
- Avoid duplicating any fields from previous tabs
- Focus on tab-specific information only

### 6. Clean Code Practices

#### Remove All Test Elements
- No console.log statements (except essential error logging)
- No debug UI elements
- No test warnings or headers
- Professional button text ("Save", not "Test Save")

#### Variable Naming
- Use clean, descriptive names
- No "test" prefixes
- Consistent naming convention

#### Comments
- Brief, functional comments
- No debug comments
- Focus on "what" not "how"

## Success Checklist

For each new interactive form:
- [ ] Clean, professional UI
- [ ] All fields are interactive (not read-only by default)
- [ ] Local state management working
- [ ] Parent onChange callbacks working
- [ ] onSave functionality working
- [ ] No console.log debug statements
- [ ] No test UI elements
- [ ] Proper disabled states for isReadOnly
- [ ] No field duplication with other tabs
- [ ] Consistent teal color scheme
- [ ] Proper accessibility attributes

## Applied Successfully To:
- ✅ Chief Complaint Tab (components/consultation/tabs/ChiefComplaintTab.tsx)

## Next Targets:
- [ ] HOPI Tab
- [ ] Medical History Tab
- [ ] Clinical Examination Tab
- [ ] Investigations Tab
- [ ] Diagnosis Tab
- [ ] Treatment Planning Tab