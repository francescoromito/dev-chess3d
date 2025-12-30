# 📝 Prompt Templates Guide

Location: `/backend/app/prompts/`

This directory contains Jinja2 templates for generating AI prompts. These templates allow for easy customization of image editing instructions without modifying code.

---

## Template Files

### 1. `rotate_90_cw.jinja`
**Purpose**: Rotate chess piece image 90 degrees clockwise

**Content**:
```jinja
Ruota l'immagine del pezzo di scacchi di 90 gradi in senso orario (verso destra).
Mantieni lo stesso stile, illuminazione e sfondo.
L'immagine dovrebbe mostrare lo stesso pezzo ma visto da un angolo ruotato di 90 gradi verso destra.
```

**Use Case**: User wants to see the piece from the right side

**Edit Type**: `rotate_90_cw`

**Variables**: None (static template)

---

### 2. `rotate_90_ccw.jinja`
**Purpose**: Rotate chess piece image 90 degrees counter-clockwise

**Content**:
```jinja
Ruota l'immagine del pezzo di scacchi di 90 gradi in senso antiorario (verso sinistra).
Mantieni lo stesso stile, illuminazione e sfondo.
L'immagine dovrebbe mostrare lo stesso pezzo ma visto da un angolo ruotato di 90 gradi verso sinistra.
```

**Use Case**: User wants to see the piece from the left side

**Edit Type**: `rotate_90_ccw`

**Variables**: None (static template)

---

### 3. `back_view.jinja`
**Purpose**: Generate back view of chess piece

**Content**:
```jinja
Genera una vista posteriore dello stesso pezzo di scacchi.
Mostra il retro del pezzo mantenendo lo stesso stile, illuminazione, materiale e sfondo dell'immagine originale.
```

**Use Case**: User wants to see the back of the piece

**Edit Type**: `back_view`

**Variables**: None (static template)

---

### 4. `generic_edit.jinja`
**Purpose**: Apply custom edits using user-provided prompts

**Content**:
```jinja
{{ custom_prompt }} Mantieni il pezzo di scacchi come soggetto principale.
Usa lo stesso stile, illuminazione e sfondo dell'immagine originale se possibile.
```

**Use Case**: User wants to make custom modifications

**Edit Type**: `generic_edit`

**Variables**: 
- `custom_prompt` (required) - User's custom editing instruction

**Example Usage**:
```python
prompt = render_prompt_template(
    "generic_edit.jinja",
    custom_prompt="Make the piece gold with reflections"
)
# Result: "Make the piece gold with reflections Mantieni il pezzo di scacchi..."
```

---

## How Templates Work

### Loading Templates

```python
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

# Static template (no variables)
def load_prompt_template(template_name: str) -> str:
    prompts_dir = Path(__file__).parent.parent / "prompts"
    env = Environment(loader=FileSystemLoader(prompts_dir))
    template = env.get_template(template_name)
    return template.render()

# Dynamic template (with variables)
def render_prompt_template(template_name: str, **kwargs) -> str:
    prompts_dir = Path(__file__).parent.parent / "prompts"
    env = Environment(loader=FileSystemLoader(prompts_dir))
    template = env.get_template(template_name)
    return template.render(**kwargs)
```

### Using Templates

**In API endpoint**:
```python
if request.edit_type == "generic_edit":
    prompt = render_prompt_template(
        "generic_edit.jinja",
        custom_prompt=request.custom_prompt
    )
else:
    template_name = f"{request.edit_type}.jinja"
    prompt = load_prompt_template(template_name)
```

---

## Customization

### Modifying Existing Templates

Edit any `.jinja` file directly with your text editor:

```jinja
# Before
Ruota l'immagine del pezzo di scacchi di 90 gradi in senso orario.

# After (more detailed)
Ruota l'immagine del pezzo di scacchi di 90 gradi in senso orario (verso destra).
Mantieni perfettamente lo stesso stile, illuminazione, sfondo, colori e materiale.
Il pezzo deve apparire identico a quello originale ma visto da un angolo ruotato di 90 gradi verso destra.
```

### Adding New Templates

1. Create new file: `backend/app/prompts/new_edit_type.jinja`
2. Add content with Jinja2 syntax
3. Register in `ai_generation.py`:

```python
# In edit_image endpoint, add to valid_edit_types
valid_edit_types = [
    "rotate_90_cw",
    "rotate_90_ccw",
    "back_view",
    "generic_edit",
    "new_edit_type"  # NEW
]
```

4. Load template:

```python
if request.edit_type == "new_edit_type":
    prompt = load_prompt_template("new_edit_type.jinja")
```

### Example: Add "Mirror" Edit

**File**: `backend/app/prompts/mirror.jinja`
```jinja
Rifletti l'immagine del pezzo di scacchi orizzontalmente (specchio).
Mantieni lo stesso stile, illuminazione e sfondo.
L'immagine dovrebbe mostrare il pezzo come se visto in uno specchio.
```

Then use in code:
```python
valid_edit_types = [..., "mirror"]

if request.edit_type == "mirror":
    prompt = load_prompt_template("mirror.jinja")
```

---

## Jinja2 Syntax Reference

### Variables
```jinja
{{ variable_name }}

Example:
{{ custom_prompt }} Mantieni lo stile
```

### Filters
```jinja
{{ text|upper }}
{{ text|lower }}
{{ text|title }}

Example:
{{ custom_prompt|capitalize }} Mantieni lo stile
```

### Conditions
```jinja
{% if condition %}
  Content if true
{% else %}
  Content if false
{% endif %}

Example:
{% if is_premium %}
  Ultra HD processing
{% else %}
  Standard processing
{% endif %}
```

### Loops
```jinja
{% for item in items %}
  {{ item }}
{% endfor %}

Example:
{% for style in styles %}
  - {{ style }}
{% endfor %}
```

---

## Best Practices

### 1. Keep Prompts Clear
✅ **Good**: "Rotate 90° clockwise maintaining the same style and lighting"
❌ **Bad**: "Rotate it"

### 2. Be Specific About Preservation
✅ **Good**: "Maintain same style, lighting, colors, and background"
❌ **Bad**: "Keep similar appearance"

### 3. Specify Output Expectations
✅ **Good**: "Generate a back view showing the rear of the piece"
❌ **Bad**: "Show the back"

### 4. Use Consistent Language
- Stick to one language (Italian in these templates)
- Use professional terminology
- Be consistent across templates

### 5. Test Before Deploying
Test template rendering before pushing to production:
```python
from jinja2 import Environment, FileSystemLoader

env = Environment(loader=FileSystemLoader("backend/app/prompts"))
template = env.get_template("rotate_90_cw.jinja")
prompt = template.render()
print(prompt)  # Verify output
```

---

## Troubleshooting

### Template Not Found
```
Error: File not found: rotate_90_cw.jinja
```
**Solution**: Verify file exists in `/backend/app/prompts/`

### Variable Not Rendering
```jinja
{{ my_var }}  # Shows blank?
```
**Solution**: Check variable is passed to render_prompt_template():
```python
render_prompt_template("template.jinja", my_var="value")
```

### Jinja2 Syntax Error
```
Error: Unexpected token in template
```
**Solution**: Check for unclosed `{% %}` or `{{ }}`

### Template Variables in Generic Edit
```python
# DON'T do this
prompt = render_prompt_template(
    "rotate_90_cw.jinja",
    custom_prompt="user input"  # Won't be used!
)

# DO this
prompt = render_prompt_template(
    "generic_edit.jinja",
    custom_prompt="user input"  # Will be used
)
```

---

## Template Testing

### Manual Test
```bash
cd backend
python -c "
from jinja2 import Environment, FileSystemLoader

env = Environment(loader=FileSystemLoader('app/prompts'))

# Test rotate_90_cw
t1 = env.get_template('rotate_90_cw.jinja')
print('CW:', t1.render())

# Test generic_edit
t2 = env.get_template('generic_edit.jinja')
print('Generic:', t2.render(custom_prompt='Make it blue'))
"
```

### Programmatic Test
```python
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

def test_templates():
    prompts_dir = Path('backend/app/prompts')
    env = Environment(loader=FileSystemLoader(prompts_dir))
    
    # Test static templates
    for template_name in ['rotate_90_cw.jinja', 'rotate_90_ccw.jinja', 'back_view.jinja']:
        template = env.get_template(template_name)
        result = template.render()
        assert len(result) > 0, f"{template_name} is empty!"
        print(f"✅ {template_name}")
    
    # Test dynamic template
    template = env.get_template('generic_edit.jinja')
    result = template.render(custom_prompt="Test prompt")
    assert "Test prompt" in result
    print(f"✅ generic_edit.jinja")

test_templates()
```

---

## Maintenance

### Updating Prompts
When you want to improve prompts:

1. Edit the template file
2. Test locally using above methods
3. Commit changes to git
4. Deploy with code changes
5. No database migration needed
6. No API changes needed

### Versioning
If you want to keep old prompts:
```
prompts/
├── rotate_90_cw.jinja          (v2.0)
├── rotate_90_cw_v1.jinja.bak   (v1.0 - archived)
├── ...
```

### Documentation
Keep this README updated when:
- Adding new templates
- Changing template behavior
- Updating language/formatting

---

## Examples

### Before & After Edit

**Original Prompt**:
```jinja
Rotate the image 90 degrees clockwise.
```

**Improved Prompt**:
```jinja
Rotate the chess piece image 90 degrees clockwise (to the right).
Maintain the exact same artistic style, lighting conditions, background color, 
and material appearance. The piece should look identical to the original but 
viewed from a rotated angle of 90 degrees to the right.
```

**Why Better**:
- More specific direction
- Clearer expectations
- Preserves visual consistency
- Better AI interpretation

---

## Related Files

- `backend/app/api/ai_generation.py` - Uses these templates
- `backend/app/api/ai_generation.py` - `load_prompt_template()` function
- `backend/app/api/ai_generation.py` - `render_prompt_template()` function
- `AI_IMAGE_EDITING_API.md` - API documentation
- `ARCHITECTURE_OVERVIEW.md` - System architecture

---

Made with ❤️ for Chess 3D
