import { notFound } from 'next/navigation';
import RecipeForm from '../../nueva/RecipeForm';
import { getIngredientOptionsAction, getRecipeByIdAction } from '@/app/actions/recipe.actions';

export default async function EditRecipePage({
    params,
    searchParams,
}: {
    params: { id: string };
    searchParams?: { volver?: string };
}) {
    const [recipe, ingredients] = await Promise.all([
        getRecipeByIdAction(params.id),
        getIngredientOptionsAction()
    ]);

    if (!recipe) {
        notFound();
    }

    // §126: ?volver=menu → el form muestra "Volver al Menú" y al guardar
    // regresa al catálogo (flujo del gerente: editar receta desde el plato).
    const returnTo = searchParams?.volver === 'menu' ? 'menu' as const : undefined;

    return <RecipeForm availableIngredients={ingredients} initialData={recipe} returnTo={returnTo} />;
}
