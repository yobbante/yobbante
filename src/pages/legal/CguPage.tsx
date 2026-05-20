import { LegalLayout, Section, COMPANY_INFO } from '@/components/legal/LegalLayout';

export default function CguPage() {
  return (
    <LegalLayout
      title="Conditions générales d'utilisation"
      updatedAt="20 mai 2026"
      description="CGU de la plateforme Yobbanté."
    >
      <Section title="1. Acceptation des conditions">
        <p>
          L'accès et l'utilisation de la plateforme Yobbanté impliquent l'acceptation sans réserve
          des présentes Conditions Générales d'Utilisation (CGU). Si vous n'acceptez pas ces
          conditions, vous devez cesser immédiatement d'utiliser la plateforme.
        </p>
      </Section>

      <Section title="2. Description des services">
        <p>Yobbanté propose les services suivants :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Expédition</strong> : envoi de colis depuis le Sénégal vers l'international ou inversement</li>
          <li><strong>Réception</strong> : mise à disposition d'adresses relais à l'étranger pour recevoir vos achats</li>
          <li><strong>Sourcing</strong> : achat de produits pour votre compte auprès de fournisseurs internationaux</li>
          <li><strong>Boutique Dëkk</strong> : vente directe de produits importés et curatés par Yobbanté</li>
        </ul>
      </Section>

      <Section title="3. Création de compte">
        <p>
          L'utilisation des services nécessite la création d'un compte. Vous vous engagez à fournir
          des informations exactes, complètes et à jour, et à les maintenir telles. Vous êtes
          responsable de la confidentialité de vos identifiants et de toute activité effectuée
          sous votre compte.
        </p>
      </Section>

      <Section title="4. Obligations de l'utilisateur">
        <ul className="list-disc pl-5 space-y-1">
          <li>Fournir des informations exactes sur le contenu des colis (nature, valeur, poids)</li>
          <li>Ne pas expédier de marchandises prohibées ou réglementées sans autorisation</li>
          <li>Respecter les lois douanières et fiscales des pays d'origine et de destination</li>
          <li>Régler les frais de service dans les délais prévus</li>
          <li>Utiliser la plateforme conformément à sa destination</li>
        </ul>
      </Section>

      <Section title="5. Contenu interdit">
        <p>Sont strictement interdits à l'expédition via Yobbanté :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Armes, munitions, explosifs</li>
          <li>Stupéfiants et substances psychotropes</li>
          <li>Espèces animales et végétales protégées</li>
          <li>Contrefaçons et produits portant atteinte à la propriété intellectuelle</li>
          <li>Matières dangereuses non déclarées (lithium, liquides inflammables, etc.)</li>
          <li>Devises, métaux et pierres précieuses non assurés</li>
          <li>Tout produit interdit par la réglementation du pays d'origine ou de destination</li>
        </ul>
        <p>
          Yobbanté se réserve le droit de refuser, retenir ou détruire tout colis en infraction,
          aux frais de l'expéditeur, et de signaler les faits aux autorités compétentes.
        </p>
      </Section>

      <Section title="6. Suspension et résiliation">
        <p>
          Yobbanté se réserve le droit de suspendre ou de résilier votre compte, sans préavis ni
          indemnité, en cas de non-respect des présentes CGU, de fraude, ou d'utilisation
          frauduleuse de la plateforme.
        </p>
        <p>
          Vous pouvez résilier votre compte à tout moment depuis votre espace personnel ou en
          contactant <a href={`mailto:${COMPANY_INFO.email}`} className="underline">{COMPANY_INFO.email}</a>.
        </p>
      </Section>

      <Section title="7. Propriété intellectuelle">
        <p>
          Tous les éléments de la plateforme (marques, logos, contenus, code) sont protégés. L'accès
          à la plateforme ne confère aucun droit de propriété ou licence d'exploitation.
        </p>
      </Section>

      <Section title="8. Responsabilité">
        <p>
          Yobbanté met en œuvre tous les moyens raisonnables pour assurer le bon fonctionnement de
          la plateforme. Toutefois, Yobbanté ne saurait être tenue responsable d'une interruption
          due à des cas de force majeure, à la maintenance, ou à des défaillances techniques tierces.
        </p>
      </Section>

      <Section title="9. Modification des CGU">
        <p>
          Yobbanté peut modifier les présentes CGU à tout moment. Les modifications entrent en
          vigueur dès leur publication. Votre utilisation continue de la plateforme vaut acceptation
          des nouvelles conditions.
        </p>
      </Section>

      <Section title="10. Droit applicable">
        <p>
          Les présentes CGU sont régies par le droit sénégalais. Tout litige relèvera des
          juridictions compétentes de Dakar.
        </p>
      </Section>
    </LegalLayout>
  );
}
