import { Link } from 'react-router-dom';
import { LegalLayout, Section, SubSection, COMPANY_INFO } from '@/components/legal/LegalLayout';

export default function ConfidentialitePage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      updatedAt="20 mai 2026"
      description="Politique de confidentialité Yobbanté — RGPD et loi sénégalaise n°2008-12."
    >
      <Section title="1. Préambule">
        <p>
          La société {COMPANY_INFO.legalForm}, dont le siège social est situé à {COMPANY_INFO.address},
          exploite la plateforme {COMPANY_INFO.name} (ci-après « Yobbanté ») accessible à l'adresse{' '}
          <a href={COMPANY_INFO.site} className="underline">{COMPANY_INFO.site}</a>.
        </p>
        <p>
          Yobbanté agit en qualité de <strong>responsable du traitement</strong> des données personnelles
          collectées via ses services d'expédition, de réception, de sourcing et de boutique Dëkk.
        </p>
        <p>
          La présente politique décrit la manière dont Yobbanté collecte, utilise, conserve et protège
          vos données personnelles, en conformité avec le Règlement Général sur la Protection des Données
          (RGPD - UE 2016/679), la loi sénégalaise n°2008-12 du 25 janvier 2008 sur la protection des
          données à caractère personnel, ainsi que les réglementations applicables dans les pays où
          Yobbanté opère.
        </p>
      </Section>

      <Section title="2. Données personnelles collectées">
        <p>Dans le cadre de la fourniture de nos services, nous collectons les catégories de données suivantes :</p>
        <SubSection title="Données d'identification">
          <ul className="list-disc pl-5 space-y-1">
            <li>Nom et prénom</li>
            <li>Adresse e-mail</li>
            <li>Numéro de téléphone (notamment WhatsApp)</li>
            <li>Adresse postale (origine et destination)</li>
            <li>Pièce d'identité (uniquement pour les expéditions soumises à formalités douanières)</li>
          </ul>
        </SubSection>
        <SubSection title="Données liées aux envois">
          <ul className="list-disc pl-5 space-y-1">
            <li>Nature, poids, dimensions et valeur déclarée des colis</li>
            <li>Coordonnées du destinataire</li>
            <li>Historique de commandes et de suivi</li>
            <li>Photos et descriptions de produits pour le sourcing</li>
          </ul>
        </SubSection>
        <SubSection title="Données de paiement">
          <p>
            Les données bancaires (carte, Wave, Orange Money) sont traitées directement par nos
            prestataires de paiement certifiés. Yobbanté n'a accès qu'aux références de transaction et
            au statut du paiement, jamais aux numéros de carte complets.
          </p>
        </SubSection>
        <SubSection title="Données techniques">
          <ul className="list-disc pl-5 space-y-1">
            <li>Adresse IP, type de navigateur, système d'exploitation</li>
            <li>Pages visitées, durée de visite (cookies essentiels uniquement)</li>
          </ul>
        </SubSection>
      </Section>

      <Section title="3. Finalités du traitement">
        <ul className="list-disc pl-5 space-y-1">
          <li>Création et gestion de votre compte client</li>
          <li>Traitement et suivi de vos expéditions, réceptions et commandes</li>
          <li>Communication avec vous (e-mail, SMS, WhatsApp) sur l'état de vos envois</li>
          <li>Facturation et comptabilité</li>
          <li>Lutte contre la fraude et respect des obligations douanières</li>
          <li>Amélioration de nos services (statistiques anonymisées)</li>
          <li>Envoi de communications marketing — uniquement avec votre consentement explicite</li>
        </ul>
      </Section>

      <Section title="4. Base légale du traitement">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Exécution du contrat</strong> : traitement de vos commandes et envois</li>
          <li><strong>Obligation légale</strong> : facturation, documentation douanière, lutte anti-blanchiment</li>
          <li><strong>Intérêt légitime</strong> : amélioration de nos services, sécurité de la plateforme</li>
          <li><strong>Consentement</strong> : newsletters, communications marketing, cookies non essentiels</li>
        </ul>
      </Section>

      <Section title="5. Durée de conservation">
        <ul className="list-disc pl-5 space-y-1">
          <li>Données de compte : pendant toute la durée de la relation contractuelle, puis 3 ans après le dernier contact</li>
          <li>Données de facturation : 10 ans (obligation comptable)</li>
          <li>Données douanières : 5 ans</li>
          <li>Cookies essentiels : 13 mois maximum</li>
          <li>Données marketing : jusqu'au retrait du consentement</li>
        </ul>
      </Section>

      <Section title="6. Destinataires des données">
        <p>Vos données peuvent être partagées avec :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Les équipes internes de Yobbanté habilitées</li>
          <li>Nos transporteurs partenaires (réseau Konnekt et compagnies aériennes/maritimes)</li>
          <li>Nos hubs logistiques à Dakar, Paris, Shenzhen, Dubaï, Montréal, New York</li>
          <li>Les autorités douanières des pays de transit et de destination</li>
          <li>Meta Platforms Inc. pour l'envoi de notifications via WhatsApp Business API</li>
          <li>Nos prestataires de paiement (Wave, Orange Money, prestataires CB)</li>
          <li>Nos sous-traitants techniques (hébergement, e-mail transactionnel)</li>
        </ul>
      </Section>

      <Section title="7. Transferts internationaux de données">
        <p>
          Yobbanté étant une plateforme de logistique internationale, vos données peuvent être
          transférées vers des pays situés en dehors de l'Union européenne et du Sénégal, notamment :
          France, Canada, États-Unis, Émirats Arabes Unis, Chine, Maroc, Côte d'Ivoire.
        </p>
        <p>
          Ces transferts sont encadrés par des garanties appropriées : clauses contractuelles types
          de la Commission européenne, décisions d'adéquation, ou consentement explicite lorsque requis.
        </p>
      </Section>

      <Section title="8. Vos droits">
        <p>Conformément au RGPD et à la loi sénégalaise n°2008-12, vous disposez des droits suivants :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Droit d'accès</strong> à vos données</li>
          <li><strong>Droit de rectification</strong> des données inexactes</li>
          <li><strong>Droit à l'effacement</strong> (« droit à l'oubli »)</li>
          <li><strong>Droit d'opposition</strong> au traitement</li>
          <li><strong>Droit à la limitation</strong> du traitement</li>
          <li><strong>Droit à la portabilité</strong> de vos données</li>
          <li><strong>Droit de retirer votre consentement</strong> à tout moment</li>
          <li><strong>Droit d'introduire une réclamation</strong> auprès de la CDP (Commission de Protection des Données Personnelles du Sénégal) ou de la CNIL</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à{' '}
          <a href={`mailto:${COMPANY_INFO.email}`} className="underline">{COMPANY_INFO.email}</a>.
        </p>
      </Section>

      <Section title="9. Sécurité">
        <p>
          Yobbanté met en œuvre des mesures techniques et organisationnelles appropriées pour
          protéger vos données : chiffrement TLS, authentification renforcée, contrôles d'accès,
          sauvegardes régulières, audits de sécurité.
        </p>
      </Section>

      <Section title="10. Cookies">
        <p>
          La plateforme utilise uniquement des cookies essentiels au bon fonctionnement du service.
          Pour plus de détails, consultez notre <Link to="/cookies" className="underline">Politique cookies</Link>.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Pour toute question relative à la protection de vos données, contactez notre référent :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email : <a href={`mailto:${COMPANY_INFO.email}`} className="underline">{COMPANY_INFO.email}</a></li>
          <li>Téléphone : {COMPANY_INFO.phone}</li>
          <li>Adresse : {COMPANY_INFO.address}</li>
        </ul>
      </Section>

      <Section title="12. Modifications">
        <p>
          Yobbanté se réserve le droit de modifier la présente politique à tout moment. Les
          modifications seront notifiées via la plateforme ou par e-mail. La version applicable est
          celle en vigueur à la date de votre connexion.
        </p>
      </Section>
    </LegalLayout>
  );
}
