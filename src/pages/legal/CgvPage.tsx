import { Link } from 'react-router-dom';
import { LegalLayout, Section, COMPANY_INFO } from '@/components/legal/LegalLayout';

export default function CgvPage() {
  return (
    <LegalLayout
      title="Conditions générales de vente"
      updatedAt="20 mai 2026"
      description="CGV applicables aux services de Yobbanté."
    >
      <Section title="1. Objet">
        <p>
          Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles
          entre {COMPANY_INFO.legalForm} (« Yobbanté ») et tout client (particulier ou professionnel)
          souscrivant à ses services d'expédition, de réception, de sourcing ou d'achat sur la
          boutique Dëkk.
        </p>
      </Section>

      <Section title="2. Prix et tarification">
        <p>
          Les prix des services sont indiqués en francs CFA (FCFA), euros (EUR) ou dollars (USD)
          selon le pays d'origine et de destination. Les tarifs d'expédition sont calculés en
          fonction du poids volumétrique, de la distance et du mode de transport choisi.
        </p>
        <p>
          La grille tarifaire couvre 36 villes desservies sur 4 continents et est consultable à
          tout moment sur <Link to="/tarifs" className="underline">la page Tarifs</Link>. Yobbanté
          se réserve le droit de modifier ses tarifs à tout moment ; les commandes en cours restent
          régies par le tarif en vigueur au moment de la confirmation.
        </p>
      </Section>

      <Section title="3. Modalités de commande">
        <p>
          La commande est passée via la plateforme Yobbanté. Elle devient ferme et définitive à
          réception du paiement (ou de l'acompte lorsqu'applicable) et après confirmation par
          Yobbanté. Un récapitulatif est envoyé par e-mail et/ou WhatsApp.
        </p>
      </Section>

      <Section title="4. Paiement">
        <p>Les moyens de paiement acceptés sont :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Wave</li>
          <li>Orange Money</li>
          <li>Paiement à la livraison (selon zones et montants)</li>
          <li>Virement bancaire (pour les comptes entreprises)</li>
          <li>Carte bancaire (à venir)</li>
        </ul>
        <p>
          Tout retard de paiement entraîne de plein droit l'application d'intérêts de retard au
          taux légal en vigueur, ainsi qu'une indemnité forfaitaire pour frais de recouvrement
          (clients professionnels).
        </p>
      </Section>

      <Section title="5. Délais de livraison">
        <p>Les délais de livraison sont indicatifs et démarrent à compter de la prise en charge effective du colis :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Aérien :</strong> 3 à 7 jours ouvrés</li>
          <li><strong>Routier (intra-Afrique) :</strong> 7 à 14 jours ouvrés</li>
          <li><strong>Maritime :</strong> 18 à 25 jours ouvrés</li>
        </ul>
        <p>
          Ces délais n'incluent pas les éventuels contrôles douaniers, qui peuvent allonger le
          temps de livraison sans engager la responsabilité de Yobbanté.
        </p>
      </Section>

      <Section title="6. Droit de rétractation">
        <p>
          Conformément à l'article L221-28 du Code de la consommation et aux pratiques internationales,
          <strong> le droit de rétractation ne s'applique pas aux prestations de transport de marchandises
          dont l'exécution a commencé avec votre accord</strong>. Une fois le colis pris en charge ou
          le sourcing initié, la commande est ferme et définitive.
        </p>
        <p>
          Pour les achats sur la boutique Dëkk, vous disposez d'un délai de rétractation de 14 jours
          à compter de la réception du produit, sous réserve qu'il n'ait pas été utilisé et soit
          retourné dans son emballage d'origine.
        </p>
      </Section>

      <Section title="7. Responsabilité en cas de perte ou dommage">
        <p>
          Yobbanté met tout en œuvre pour acheminer les colis dans les meilleures conditions. En cas
          de perte ou de dommage avéré et imputable à Yobbanté :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>L'indemnisation standard est plafonnée à 20 EUR / kg dans la limite de la valeur déclarée</li>
          <li>L'assurance Premium (en option) couvre la valeur réelle du colis jusqu'à 5 000 EUR</li>
          <li>Aucune indemnisation pour les contenus prohibés ou non déclarés</li>
        </ul>
      </Section>

      <Section title="8. Assurance">
        <p>
          Une assurance standard est incluse dans tous les envois. Une assurance Premium peut être
          souscrite au moment de la commande, moyennant une cotisation calculée sur la valeur
          déclarée du colis.
        </p>
      </Section>

      <Section title="9. Réclamations et service après-vente">
        <p>
          Toute réclamation doit être adressée à{' '}
          <a href={`mailto:${COMPANY_INFO.email}`} className="underline">{COMPANY_INFO.email}</a>{' '}
          ou via WhatsApp au {COMPANY_INFO.phone}, dans un délai maximal de 14 jours à compter de la
          livraison (ou de la date prévue de livraison en cas de non-réception). Toute réclamation
          tardive sera réputée irrecevable.
        </p>
      </Section>

      <Section title="10. Force majeure">
        <p>
          Yobbanté ne pourra être tenue responsable en cas de force majeure : catastrophe naturelle,
          grève, conflit armé, fermeture de frontières, pandémie, blocage douanier, ou tout autre
          événement imprévisible et irrésistible.
        </p>
      </Section>

      <Section title="11. Litiges">
        <p>
          En cas de litige, les parties s'engagent à rechercher une solution amiable avant toute
          action en justice. À défaut, le litige sera porté devant les juridictions compétentes de
          Dakar, droit sénégalais applicable.
        </p>
        <p>
          Pour les clients consommateurs résidant dans l'Union européenne, ceux-ci ont également la
          possibilité de recourir à la plateforme européenne de règlement en ligne des litiges.
        </p>
      </Section>
    </LegalLayout>
  );
}
