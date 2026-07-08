import { requireConversacionesPage } from '@/lib/wa/require-conversaciones-page';
import {
    listWaConversationsAction,
    listWaTemplatesAction,
    getWaModuleHealthAction,
} from '@/app/actions/wa.actions';
import ConversationsView from './conversations-view';

export const metadata = {
    title: 'Conversaciones | KPSULA',
    description: 'Bandeja de conversaciones de WhatsApp (bot + humano)',
};

export const dynamic = 'force-dynamic';

export default async function ConversacionesPage() {
    const { role } = await requireConversacionesPage();

    const [list, templates, health] = await Promise.all([
        listWaConversationsAction(),
        listWaTemplatesAction(),
        getWaModuleHealthAction(),
    ]);

    return (
        <ConversationsView
            initialConversations={list.success ? list.data ?? [] : []}
            templates={templates.success ? (templates.data ?? []).map((t: any) => ({
                id: t.id,
                name: t.name,
                language: t.language,
                category: t.category,
                bodyPreview: t.bodyPreview,
                variablesCount: t.variablesCount,
                approvalStatus: t.approvalStatus,
            })) : []}
            health={health.success ? health.data : { hasCredential: false, credentialActive: false, displayPhone: null }}
            canConfigure={['OWNER', 'ADMIN_MANAGER'].includes(role)}
        />
    );
}
