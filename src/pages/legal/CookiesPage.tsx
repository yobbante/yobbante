import { Link } from 'react-router-dom';
import { LegalLayout, Section, COMPANY_INFO } from '@/components/legal/LegalLayout';

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Politique cookies"
      updatedAt="20 mai 2026"
      description="Politique d'utilisation des cookies par Yobbanté."
    >
      <Section title="1. Qu'est-ce qu'un cookie ?">
        <p>
          Un cookie est un petit fichier texte déposé sur votre appareil (ordinateur, smartphone,
          tablette) lors de la consultation d'un site web. Il permet au site de mémoriser des
          informations relatives à votre navigation : préférences linguistiques, état de connexion,
          contenu du panier, etc.
        </p>
      </Section>

      <Section title="2. Cookies utilisés par Yobbanté">
        <p>
          Yobbanté utilise <strong>uniquement des cookies essentiels</strong> au bon fonctionnement
          de la plateforme. Aucun cookie de tracking publicitaire, de profilage ou de revente de
          données à des tiers n'est déposé sur votre appareil.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm border border-border">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 border-b border-border font-semibold">Nom</th>
                <th className="px-3 py-2 border-b border-border font-semibold">Finalité</th>
                <th className="px-3 py-2 border-b border-border font-semibold">Durée</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 border-b border-border">sb-auth-token</td>
                <td className="px-3 py-2 border-b border-border">Maintien de la session authentifiée</td>
                <td className="px-3 py-2 border-b border-border">Session / 7 jours</td>
              </tr>
              <tr>
                <td className="px-3 py-2 border-b border-border">yobbante.cookies.v1</td>
                <td className="px-3 py-2 border-b border-border">Mémorisation de votre choix de consentement</td>
                <td className="px-3 py-2 border-b border-border">13 mois</td>
              </tr>
              <tr>
                <td className="px-3 py-2 border-b border-border">yobbante.draft.*</td>
                <td className="px-3 py-2 border-b border-border">Sauvegarde des formulaires en cours</td>
                <td className="px-3 py-2 border-b border-border">30 jours</td>
              </tr>
              <tr>
                <td className="px-3 py-2">yobbante.cart</td>
                <td className="px-3 py-2">Conservation du panier Boutique Dëkk</td>
                <td className="px-3 py-2">30 jours</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="3. Cookies tiers">
        <p>
          Lorsque vous interagissez avec WhatsApp via notre plateforme, Meta peut déposer ses
          propres cookies conformément à sa politique. Yobbanté n'a pas accès à ces cookies.
        </p>
      </Section>

      <Section title="4. Gestion du consentement">
        <p>
          Lors de votre première visite, une bannière vous permet d'accepter ou de refuser le
          dépôt de cookies non strictement essentiels. Vous pouvez modifier votre choix à tout
          moment en effaçant les cookies de votre navigateur, ou en nous contactant à{' '}
          <a href={`mailto:${COMPANY_INFO.email}`} className="underline">{COMPANY_INFO.email}</a>.
        </p>
        <p>
          Vous pouvez également configurer votre navigateur pour bloquer ou supprimer les cookies.
          Attention : le blocage des cookies essentiels peut empêcher le bon fonctionnement de
          certaines parties de la plateforme (notamment la connexion à votre compte).
        </p>
      </Section>

      <Section title="5. Durée de conservation">
        <p>
          Les cookies essentiels sont conservés pour une durée maximale de 13 mois, conformément
          aux recommandations des autorités de protection des données.
        </p>
      </Section>

      <Section title="6. En savoir plus">
        <p>
          Pour plus d'informations sur le traitement de vos données personnelles, consultez notre{' '}
          <Link to="/confidentialite" className="underline">Politique de confidentialité</Link>.
        </p>
      </Section>
    </LegalLayout>
  );
}
