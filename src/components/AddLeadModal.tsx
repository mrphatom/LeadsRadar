import React, { useState, useEffect } from 'react';
import { X, Building2, Globe, MapPin, Phone, Mail, ClipboardList, Plus } from 'lucide-react';
import { BusinessLead, CountryType, LeadStatus } from '../types';

interface AddLeadModalProps {
  onClose: () => void;
  onAddLead: (lead: BusinessLead) => void;
}

export default function AddLeadModal({ onClose, onAddLead }: AddLeadModalProps) {
  // Lock background body scroll to eliminate jitter
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const [name, setName] = useState('');
  const [country, setCountry] = useState<CountryType>('USA');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('Bakery');
  const [customCategory, setCustomCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalCategory = category === 'Custom' ? customCategory : category;

    const newLead: BusinessLead = {
      id: `lead_manual_${Date.now()}`,
      name: name.trim(),
      country,
      city: city.trim() || 'Local Area',
      address: address.trim() || undefined,
      category: finalCategory.trim() || 'General Business',
      phone: phone.trim() || 'No Phone Listed',
      email: email.trim() || 'contact@example.local',
      status: 'new',
      notes: notes.trim() || 'Manually entered local business lacking an active website.',
      createdAt: new Date().toISOString(),
      activityLog: [
        {
          id: `log_init_${Date.now()}`,
          type: 'note',
          timestamp: new Date().toISOString(),
          title: 'Prospect Entry Registered',
          detail: 'Lead manually registered into central tracking database.'
        }
      ]
    };

    onAddLead(newLead);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/95 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl max-w-lg w-full border border-zinc-800 shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="bg-zinc-950 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold tracking-tight">Manual Prospect Enrollment</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">Record a offline local business with physical presence but no digital domain</p>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 p-2 rounded-lg cursor-pointer transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-zinc-900">
          
          {/* Business Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-zinc-500" /> Business name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Portland Pizza Co."
              required
              className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Country Selection */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-zinc-500" /> Territory
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryType)}
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-350 focus:outline-hidden"
              >
                <option value="USA">USA 🇺🇸</option>
                <option value="UK">UK 🇬🇧</option>
                <option value="Germany">Germany 🇩🇪</option>
                <option value="Canada">Canada 🇨🇦</option>
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" /> City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Seattle"
                required
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Physical Address */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-zinc-500" /> Street Address (Optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 1205 Pine St, Seattle, WA"
              className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>

          {/* Business Niche */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-zinc-500" /> Category
            </label>
            <div className="grid grid-cols-1 gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-350 focus:outline-hidden"
              >
                <option value="Bakery" className="bg-zinc-950 text-zinc-200">Bakery</option>
                <option value="Dentist" className="bg-zinc-950 text-zinc-200">Dentist</option>
                <option value="Electrician" className="bg-zinc-950 text-zinc-200">Electrician</option>
                <option value="Plumbing" className="bg-zinc-950 text-zinc-200">Plumbing</option>
                <option value="Roofing" className="bg-zinc-950 text-zinc-200">Roofing</option>
                <option value="Auto Mechanic" className="bg-zinc-950 text-zinc-200">Auto Mechanic</option>
                <option value="Cafe" className="bg-zinc-950 text-zinc-200">Cafe</option>
                <option value="Hair Salon" className="bg-zinc-950 text-zinc-200">Hair Salon</option>
                <option value="Local Restaurant" className="bg-zinc-950 text-zinc-200">Local Restaurant</option>
                <option value="Custom" className="bg-zinc-950 text-zinc-200">-- Custom Category --</option>
              </select>

              {category === 'Custom' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Specify Custom Niche (e.g. Carpentry)"
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-200"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-zinc-500" /> Direct Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 (206) 555-1234"
                required
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-655"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-zinc-500" /> Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. contact@portlandpizza.local"
                required
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-655"
              />
            </div>
          </div>

          {/* Discovery Notes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 tracking-wider mb-1.5 flex items-center gap-1.5">
              💡 Discovery Audit Notes / Web absence context
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. High Google ratings and visible foot traffic. Only online footprint is an unofficial facebook page with menu pictures outdated by 2 years. Could benefit strongly from custom reservations portals."
              className="w-full text-xs p-3.5 rounded-lg border border-zinc-800 min-h-[80px] focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>

          {/* Form Actions footer */}
          <div className="pt-3 border-t border-zinc-800 flex justify-end gap-3.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4.5 py-2 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-400 bg-zinc-950 hover:bg-zinc-900 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-xs font-bold text-zinc-950 flex items-center gap-1 shadow-xs hover:shadow-sm cursor-pointer transition-colors"
            >
              <Plus className="h-4 w-4" /> Enlist Prospect
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
