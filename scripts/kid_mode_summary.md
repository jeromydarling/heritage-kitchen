# Kid Mode payload summary

Recipes to process: **343**
Lessons to process: **65**

## Recipe selection criteria

- Any recipe tagged `kid-friendly` or `kids`
- Any recipe in the `kids-in-the-kitchen` category

## Expected Perplexity response shape

### Per recipe

```json
{
  "id": "bcs-apple-pie",
  "kid_jobs": ["Wash the apples.", "Press the pie crust into the pan."],
  "grownup_jobs": ["Slice the apples thin with a sharp knife.", "Put the pie in the oven."],
  "together_jobs": ["Arrange the apple slices in the crust."],
  "teaching_moments": [
    "Apples brown when you cut them because oxygen in the air reacts with the juice. A splash of lemon stops it.",
    "Butter makes the crust flaky because the little chunks melt in the oven and leave layers of air."
  ],
  "prep_ahead": ["Preheat the oven to 425°F.", "Do all the knife work.", "Put out the stepstool."]
}
```

### Per lesson

```json
{
  "id": "shc-yeast-bread",
  "kid_explainer": "Yeast is a tiny living thing. It's smaller than you can see, but you can put it in warm water with a spoonful of sugar and watch it wake up..."
}
```

## Drop the result at

`public/heritage_kitchen_kid_mode.json` — the render step in
commit 7 will pick it up automatically.