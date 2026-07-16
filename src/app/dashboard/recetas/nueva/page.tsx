
import { getIngredientOptionsAction } from '@/app/actions/recipe.actions';
import RecipeForm from './RecipeForm';

export const dynamic = 'force-dynamic';

export default async function NewRecipePage({
    searchParams,
}: {
    searchParams?: { tipo?: string };
}) {
    const ingredientOptions = await getIngredientOptionsAction();

    // §120: ?tipo=SUB_RECIPE|FINISHED_GOOD preselecciona el tipo (ej. botón
    // "Nueva sub-receta" de Producción). Cualquier otro valor se ignora.
    const tipo = searchParams?.tipo;
    const initialType = tipo === 'SUB_RECIPE' || tipo === 'FINISHED_GOOD' ? tipo : undefined;

    return (
        <RecipeForm availableIngredients={ingredientOptions} initialType={initialType} />
    );
}
