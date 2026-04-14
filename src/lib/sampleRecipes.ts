import type { Recipe } from './types';

// A small curated set of public-domain recipes used as a fallback when the
// full dataset has not yet been added to /public/recipes.json or seeded into
// Supabase. These mirror the real JSON structure so the UI renders properly.
export const sampleRecipes: Recipe[] = [
  {
    id: 'bcs-sour-milk-griddle-cakes',
    title: 'Sour Milk Griddle-Cakes',
    source_book: 'The Boston Cooking-School Cook Book',
    source_author: 'Fannie Merritt Farmer',
    source_year: '1896',
    source_url: 'https://www.gutenberg.org/ebooks/65061',
    category: 'breakfast-and-bakes',
    original_recipe:
      '2 1/2 cups flour. 1 teaspoon soda. 1 teaspoon salt. 2 cups sour milk. 1 egg. 1 tablespoon melted butter.\n\nMix and sift dry ingredients; add sour milk, egg well beaten, and butter. Drop by spoonfuls on a hot greased griddle; cook on one side until puffed, full of bubbles, and cooked on edges; turn and cook other side. Serve with maple syrup.',
    modern_recipe: {
      description:
        "Fluffy, tangy pancakes that rely on buttermilk and baking soda for their lift — a classic weekend breakfast from Fannie Farmer's landmark cookbook.",
      prep_time: '10 minutes',
      cook_time: '15 minutes',
      servings: '12 pancakes',
      ingredients: [
        '2½ cups all-purpose flour',
        '1 teaspoon baking soda',
        '1 teaspoon fine salt',
        '2 cups buttermilk',
        '1 large egg',
        '1 tablespoon melted butter, plus more for the pan',
        'Maple syrup, to serve',
      ],
      instructions: [
        'Whisk the flour, baking soda, and salt together in a large bowl.',
        'In a second bowl, whisk the buttermilk, egg, and melted butter until smooth.',
        'Pour the wet ingredients into the dry and stir just until combined — a few lumps are fine.',
        'Heat a griddle or large nonstick skillet over medium heat and brush lightly with butter.',
        'Drop scant ¼-cup portions of batter onto the griddle. Cook until the edges look set and bubbles break across the surface, about 2 minutes. Flip and cook another 1–2 minutes, until golden.',
        'Serve hot with plenty of maple syrup.',
      ],
      tips: 'No buttermilk? Stir 2 tablespoons of lemon juice into 2 cups of whole milk and let sit for 5 minutes.',
    },
    history_note:
      'In 1896, "sour milk" meant naturally soured farm milk — the everyday alternative to sweet milk. When Fannie Farmer standardized measurements at the Boston Cooking School, recipes like this one could finally be followed to the letter by cooks far from her classroom.',
    tags: ['kid-friendly', 'quick', 'comfort-food', 'breakfast'],
    difficulty: 'easy',
    image_prompt:
      'Vintage hand-drawn watercolor cookbook illustration of a tall stack of golden buttermilk pancakes on a cream ceramic plate, maple syrup pooling, soft natural light. No text, no labels, no words, no titles, no decorative borders, no frames, no ornamental elements. Just the food on the plate.',
    image_url: null,
  },
  {
    id: 'bcs-cream-of-tomato-soup',
    title: 'Cream of Tomato Soup',
    source_book: 'The Boston Cooking-School Cook Book',
    source_author: 'Fannie Merritt Farmer',
    source_year: '1896',
    source_url: 'https://www.gutenberg.org/ebooks/65061',
    category: 'soups-and-stews',
    original_recipe:
      '1 quart stewed and strained tomatoes. 1 pint milk. 1/4 teaspoon soda. 2 tablespoons butter. 2 tablespoons flour. 1 teaspoon salt. 1/8 teaspoon pepper.\n\nCook and strain tomatoes. Scald milk. Melt butter, add flour, and when well mixed, add gradually hot milk. Add tomato, seasonings, and soda. Strain and serve immediately.',
    modern_recipe: {
      description:
        "A silky, classic cream of tomato soup. The pinch of baking soda is Fannie's trick to keep the milk from curdling when it hits the acidic tomatoes.",
      prep_time: '10 minutes',
      cook_time: '20 minutes',
      servings: '4 bowls',
      ingredients: [
        '1 quart canned whole tomatoes (or 4 cups fresh, chopped)',
        '2 cups whole milk',
        '¼ teaspoon baking soda',
        '2 tablespoons unsalted butter',
        '2 tablespoons all-purpose flour',
        '1 teaspoon fine salt',
        'Freshly ground pepper, to taste',
      ],
      instructions: [
        'Simmer the tomatoes in a saucepan for 10 minutes, then press through a strainer into a bowl. Discard the seeds and skins.',
        "Warm the milk in a small pot until steaming — don't let it boil.",
        'In a clean saucepan, melt the butter over medium heat. Whisk in the flour and cook for 1 minute, until it smells nutty.',
        'Slowly whisk in the hot milk. Cook, stirring, until the sauce thickens enough to coat a spoon.',
        'Whisk in the strained tomato, then the baking soda — it will foam briefly. Season with salt and pepper and serve right away.',
      ],
      tips: 'Serve with buttered toast soldiers or oyster crackers for a proper 1890s lunch.',
    },
    history_note:
      "Cream of tomato soup was a novelty dish in the late 19th century, made possible by the new availability of canned tomatoes. Campbell's would commercialize the formula in 1897, just a year after this recipe appeared.",
    tags: ['soup', 'comfort-food', 'weeknight'],
    difficulty: 'easy',
    image_prompt:
      'Vintage hand-drawn watercolor cookbook illustration of a shallow cream bowl of tomato bisque with a swirl of cream, on a worn wooden table. Soft natural light. No text, no labels, no words, no titles, no decorative borders, no frames, no ornamental elements. Just the food on the plate.',
    image_url: null,
  },
  {
    id: 'mpl-baked-beans',
    title: 'Baked Beans',
    source_book: "Miss Parloa's New Cook Book",
    source_author: 'Maria Parloa',
    source_year: '1887',
    source_url: 'https://www.gutenberg.org/ebooks/43772',
    category: 'main-dishes',
    original_recipe:
      'One quart of beans; one pound of salt pork; one tablespoonful of molasses; one teaspoonful of mustard; one teaspoonful of salt.\n\nPick over and wash the beans, then cover them with cold water, and let them soak overnight. In the morning drain them and put in a kettle with plenty of fresh water; let them come slowly to a boil. Scald the pork, scrape it well, and score the rind. Put the beans in an earthen pot, bury the pork in the beans, with the rind just appearing, add the salt, mustard, and molasses, dissolved in a cup of boiling water, and pour on enough boiling water to cover the beans. Bake slowly for eight hours, adding more water as needed.',
    modern_recipe: {
      description:
        'The long, slow-baked New England classic — sweet with molasses, smoky from the pork, and worth starting the day before.',
      prep_time: '15 minutes (plus overnight soak)',
      cook_time: '8 hours',
      servings: '8',
      ingredients: [
        '1 lb (about 2¼ cups) dried navy beans',
        '8 oz salt pork or thick-cut bacon, scored',
        '¼ cup molasses',
        '1 teaspoon dry mustard',
        '1 teaspoon fine salt',
        '1 small yellow onion, peeled (optional, modern addition)',
      ],
      instructions: [
        'The night before: cover the beans with cold water by 2 inches and soak overnight.',
        'Drain the beans and put them in a pot with fresh cold water. Bring slowly to a simmer and cook for 10 minutes, skimming any foam. Drain, reserving the liquid.',
        'Heat the oven to 275°F (135°C). Put the beans in a bean pot or Dutch oven. Nestle the pork into the beans so the scored rind just shows on top. Tuck in the onion if using.',
        'Dissolve the molasses, mustard, and salt in a cup of boiling water and pour over the beans. Add enough of the reserved cooking liquid to cover.',
        'Cover and bake for 6 hours. Uncover and bake 2 hours more, adding hot water as needed to keep the beans moist. They are done when the beans are tender and the sauce is glossy and thick.',
      ],
      tips: 'A splash of cider vinegar just before serving brightens the finished pot considerably.',
    },
    history_note:
      "Baked beans in a glazed earthenware pot were a Saturday-night fixture in Puritan New England, cooked overnight to avoid work on the Sabbath. Miss Parloa's 1887 version is the classic Boston formula.",
    tags: ['main-dish', 'make-ahead', 'new-england'],
    difficulty: 'moderate',
    image_prompt:
      'Vintage hand-drawn watercolor cookbook illustration of a brown earthenware bean pot filled with glossy baked beans, a piece of salt pork peeking out on top. Soft natural light. No text, no labels, no words, no titles, no decorative borders, no frames, no ornamental elements. Just the food on the plate.',
    image_url: null,
  },
  {
    id: 'bcs-chocolate-cake',
    title: 'Chocolate Cake',
    source_book: 'The Boston Cooking-School Cook Book',
    source_author: 'Fannie Merritt Farmer',
    source_year: '1896',
    source_url: 'https://www.gutenberg.org/ebooks/65061',
    category: 'desserts',
    original_recipe:
      '1/2 cup butter. 1 1/2 cups sugar. 2 eggs. 1/2 cup milk. 1 3/4 cups flour. 3 teaspoons baking powder. 2 squares chocolate, melted. 1 teaspoon vanilla.\n\nCream the butter, add sugar gradually, and eggs well beaten. Mix and sift flour and baking powder; add alternately with milk to first mixture. Add chocolate and vanilla. Bake in a buttered and floured shallow pan in a moderate oven thirty minutes.',
    modern_recipe: {
      description: 'A plain, honest chocolate layer cake from 1896 — tender crumb, deep cocoa flavor, no frills.',
      prep_time: '15 minutes',
      cook_time: '30 minutes',
      servings: 'One 9-inch cake',
      ingredients: [
        '½ cup (1 stick) unsalted butter, softened',
        '1½ cups granulated sugar',
        '2 large eggs',
        '½ cup whole milk',
        '1¾ cups all-purpose flour',
        '3 teaspoons baking powder',
        '¼ teaspoon salt',
        '2 oz unsweetened chocolate, melted and cooled',
        '1 teaspoon vanilla extract',
      ],
      instructions: [
        'Heat the oven to 350°F (175°C). Butter and flour a 9-inch round or 8-inch square pan.',
        'Cream the butter, then beat in the sugar gradually until fluffy. Beat in the eggs one at a time.',
        'Whisk the flour, baking powder, and salt together. Add to the butter mixture in three parts, alternating with the milk.',
        'Stir in the melted chocolate and vanilla until the batter is smooth and evenly colored.',
        'Scrape into the pan and bake 28–32 minutes, until a toothpick comes out with a few moist crumbs. Cool in the pan 10 minutes, then turn out onto a rack.',
      ],
      tips: 'Fannie suggests plain boiled frosting; a simple dusting of powdered sugar is equally period-appropriate.',
    },
    history_note:
      "Chocolate as a baking ingredient was still a relative luxury in 1896, measured in \"squares\" of unsweetened baking chocolate from Baker's of Dorchester, Massachusetts — just a few miles from the Boston Cooking School itself.",
    tags: ['dessert', 'cake', 'chocolate', 'kid-friendly'],
    difficulty: 'easy',
    image_prompt:
      'Vintage hand-drawn watercolor cookbook illustration of a simple round chocolate layer cake on a glass cake stand, one slice removed to show the crumb. Soft natural light. No text, no labels, no words, no titles, no decorative borders, no frames, no ornamental elements. Just the food on the plate.',
    image_url: null,
  },
  {
    id: 'stl-lemonade',
    title: 'Lemonade',
    source_book: 'The Settlement Cook Book',
    source_author: 'Mrs. Simon Kander',
    source_year: '1901',
    source_url: 'https://www.gutenberg.org/ebooks/27291',
    category: 'beverages',
    original_recipe:
      'Juice of six lemons, six tablespoonfuls of sugar, one quart of water, ice. Dissolve the sugar in a little boiling water, add the lemon juice and cold water, pour over ice and serve.',
    modern_recipe: {
      description: 'Real lemonade, made the way every church-supper cookbook taught it — a quick syrup, fresh juice, cold water, and ice.',
      prep_time: '10 minutes',
      cook_time: '0 minutes',
      servings: '1 quart',
      ingredients: [
        '½ cup granulated sugar',
        '½ cup boiling water',
        '¾ cup fresh-squeezed lemon juice (about 6 lemons)',
        '3 cups cold water',
        'Ice',
      ],
      instructions: [
        'Stir the sugar into the boiling water until fully dissolved. Let cool slightly.',
        'Combine the syrup, lemon juice, and cold water in a pitcher. Taste and add more sugar or water to your liking.',
        'Pour over plenty of ice and serve right away.',
      ],
      tips: 'For a pink version, add a splash of cranberry juice or a few crushed raspberries to the pitcher.',
    },
    history_note:
      'The Settlement Cook Book, born from a Milwaukee settlement house cooking class for immigrant women, became one of the best-selling American cookbooks of the 20th century. Simple drinks like this one taught measurement and technique.',
    tags: ['kid-friendly', 'quick', 'drink', 'summer'],
    difficulty: 'easy',
    image_prompt:
      'Vintage hand-drawn watercolor cookbook illustration of a tall glass pitcher of lemonade with lemon slices and ice, two glasses beside it. Soft natural light. No text, no labels, no words, no titles, no decorative borders, no frames, no ornamental elements. Just the drink.',
    image_url: null,
  },
  {
    id: 'mpl-apple-sauce',
    title: 'Apple Sauce',
    source_book: "Miss Parloa's New Cook Book",
    source_author: 'Maria Parloa',
    source_year: '1887',
    source_url: 'https://www.gutenberg.org/ebooks/43772',
    category: 'sauces-and-condiments',
    original_recipe:
      'Pare, core, and quarter eight good-sized tart apples. Put them in a porcelain-lined sauce pan with a cup of water and half a cup of sugar. Cover, and cook gently until tender. Add a little grated nutmeg, and serve either hot or cold.',
    modern_recipe: {
      description: 'Soft, spoonable, barely-sweet applesauce. Perfect with pork chops, pancakes, or straight from the jar.',
      prep_time: '10 minutes',
      cook_time: '25 minutes',
      servings: 'About 3 cups',
      ingredients: [
        '8 tart apples (Granny Smith, Cortland, or Northern Spy)',
        '1 cup water',
        '¼–½ cup granulated sugar, to taste',
        'Pinch of freshly grated nutmeg',
        'Squeeze of lemon juice (optional, modern addition)',
      ],
      instructions: [
        'Peel, core, and quarter the apples.',
        'Combine the apples and water in a nonreactive saucepan. Cover and cook over medium-low heat, stirring occasionally, until the apples fall apart — about 20 minutes.',
        'Stir in the sugar a little at a time, tasting as you go. Add the nutmeg and a squeeze of lemon juice.',
        'Cook 3–5 minutes more to dissolve the sugar. Mash smooth with a spoon, or leave chunky. Serve warm or chilled.',
      ],
      tips: 'A cinnamon stick simmered with the apples is a lovely (and period-appropriate) addition.',
    },
    history_note:
      "Before refrigeration, applesauce was the easiest way to stretch the autumn apple harvest through the winter. Every 19th-century cookbook has a version — this one is Miss Parloa's at its most frugal.",
    tags: ['kid-friendly', 'quick', 'condiment', 'fall'],
    difficulty: 'easy',
    image_prompt:
      'Vintage hand-drawn watercolor cookbook illustration of a small glass bowl of chunky homemade applesauce beside a whole red apple. Soft natural light. No text, no labels, no words, no titles, no decorative borders, no frames, no ornamental elements. Just the food on the plate.',
    image_url: null,
  },
];
