'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import {
  FestivalTemplate,
  FestivalCampaign,
  FestivalSectionConfig,
  FestivalTheme,
  AIGenerateTemplatePrompt,
  AIGeneratedVariation,
  SectionType,
  TemplateCategory,
} from '@/types/festival';
import { generateAITemplateVariations, applyAIModification } from '@/lib/festivalAiEngine';
import { validateFestivalCampaign, validateFestivalTemplate, APPROVED_SECTION_TYPES } from '@/lib/festivalValidator';
import { FestivalCampaignRenderer } from '@/components/customer/festival/FestivalCampaignRenderer';
import { showToast } from '@/components/ui/Toast';
import {
  Sparkles,
  Layers,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Clock,
  Smartphone,
  Monitor,
  Tablet,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  Bot,
  Send,
  Sliders,
  History,
  CheckCheck,
  Tag,
  Palette,
  Layout,
  ExternalLink,
} from 'lucide-react';

export function FestivalCampaignsCMS() {
  const {
    festivalTemplates,
    festivalCampaigns,
    festivalAuditLogs,
    isFestivalEmergencyDisabled,
    addFestivalTemplate,
    updateFestivalTemplate,
    duplicateFestivalTemplate,
    archiveFestivalTemplate,
    addFestivalCampaign,
    updateFestivalCampaign,
    publishFestivalCampaign,
    rollbackFestivalCampaign,
    toggleEmergencyFestivalDisable,
    addFestivalAuditLog,
    categories,
    products,
  } = useAppStore();

  // Top-level Navigation inside CMS
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'templates' | 'builder' | 'audit'>('campaigns');

  // Active / Selected Template or Campaign for Builder
  const [editingTemplate, setEditingTemplate] = useState<FestivalTemplate | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<FestivalCampaign | null>(null);

  // Template Library Filter & Search
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<TemplateCategory | 'ALL'>('ALL');
  const [templateSearch, setTemplateSearch] = useState('');

  // AI Generator Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<AIGenerateTemplatePrompt>({
    festivalName: 'Ganesh Chaturthi',
    festivalDescription: 'Premium festive grocery shopping for Ganesh Chaturthi celebrations with Modaks, Puja essentials & snacks.',
    preferredDesignStyle: 'premium_festive',
    primaryColor: '#EA580C',
    secondaryColor: '#9A3412',
    accentColor: '#FEF3C7',
    ctaText: 'SHOP FESTIVAL SPECIALS',
  });
  const [aiGeneratedVariations, setAiGeneratedVariations] = useState<AIGeneratedVariation[]>([]);

  // In-Editor AI Prompt Assistant
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiChatApplying, setIsAiChatApplying] = useState(false);

  // Live Multi-Device Preview Mode ('desktop' | 'tablet' | 'mobile')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showLivePreviewModal, setShowLivePreviewModal] = useState(false);

  // Pre-Publish Validation Drawer / Modal
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateFestivalCampaign> | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Version History Rollback Modal
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [selectedRollbackCampaign, setSelectedRollbackCampaign] = useState<FestivalCampaign | null>(null);

  // Campaign Scheduling Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    name: '',
    festivalName: '',
    templateId: '',
    startAt: new Date().toISOString().slice(0, 16),
    endAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    priority: 100,
  });

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return festivalTemplates.filter((t) => {
      const matchesCat = templateCategoryFilter === 'ALL' || t.category === templateCategoryFilter;
      const matchesSearch =
        !templateSearch ||
        t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(templateSearch.toLowerCase()));
      return matchesCat && matchesSearch && !t.isArchived;
    });
  }, [festivalTemplates, templateCategoryFilter, templateSearch]);

  // ── HANDLERS ──

  // Trigger AI Generation
  const handleGenerateWithAI = () => {
    if (!aiPrompt.festivalName.trim()) {
      showToast('Please enter a festival name.', 'error');
      return;
    }
    setIsAiGenerating(true);
    setTimeout(() => {
      const variations = generateAITemplateVariations(aiPrompt);
      setAiGeneratedVariations(variations);
      setIsAiGenerating(false);
      showToast(`Generated ${variations.length} design variations!`, 'success');
    }, 600);
  };

  // Adopt AI Generated Template
  const handleAdoptAITemplate = (variation: AIGeneratedVariation) => {
    const saved = addFestivalTemplate(variation.template);
    setShowAiModal(false);
    setEditingTemplate(saved);
    setActiveSubTab('builder');
    showToast(`Template "${saved.name}" created and loaded into Section Builder!`, 'success');
  };

  // Duplicate Template
  const handleDuplicate = (templateId: string) => {
    const copy = duplicateFestivalTemplate(templateId);
    if (copy) {
      showToast(`Duplicated as "${copy.name}".`, 'success');
    }
  };

  // Open Template in Section Builder
  const handleEditTemplate = (template: FestivalTemplate) => {
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
    setEditingCampaign(null);
    setActiveSubTab('builder');
  };

  // In-Editor AI Assistant
  const handleApplyAIAssistant = () => {
    if (!aiChatInput.trim() || !editingTemplate) return;
    setIsAiChatApplying(true);
    setTimeout(() => {
      const { updatedTemplate, summary } = applyAIModification(editingTemplate, aiChatInput);
      setEditingTemplate(updatedTemplate);
      setIsAiChatApplying(false);
      setAiChatInput('');
      showToast(summary, 'success');
    }, 500);
  };

  // Save changes in Section Builder
  const handleSaveBuilder = () => {
    if (!editingTemplate) return;
    updateFestivalTemplate(editingTemplate.id, editingTemplate);
    showToast('Template design configuration saved successfully!', 'success');
  };

  // Quick Launch Campaign from Template
  const handleLaunchCampaignFromTemplate = (template: FestivalTemplate) => {
    setScheduleData({
      name: `${template.name} Campaign`,
      festivalName: template.name.split('(')[0].trim(),
      templateId: template.id,
      startAt: new Date().toISOString().slice(0, 16),
      endAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      priority: 100,
    });
    setEditingTemplate(template);
    setShowScheduleModal(true);
  };

  // Submit Schedule & Publish Campaign
  const handleSaveCampaignSchedule = (andPublish = false) => {
    if (!editingTemplate) return;
    const validation = validateFestivalTemplate(editingTemplate);
    if (!validation.isValid) {
      showToast('Cannot launch campaign: please fix template validation errors first.', 'error');
      return;
    }

    const newCampaign = addFestivalCampaign({
      name: scheduleData.name || `${editingTemplate.name} Campaign`,
      festivalName: scheduleData.festivalName || editingTemplate.name,
      templateId: editingTemplate.id,
      templateVersion: editingTemplate.version || 1,
      status: andPublish ? 'PUBLISHED' : 'SCHEDULED',
      priority: Number(scheduleData.priority) || 100,
      startAt: new Date(scheduleData.startAt).toISOString(),
      endAt: new Date(scheduleData.endAt).toISOString(),
      timezone: 'Asia/Kolkata',
      configurationSnapshot: {
        theme: editingTemplate.theme,
        sections: editingTemplate.sections,
        festivalName: scheduleData.festivalName || editingTemplate.name,
      },
    });

    if (andPublish) {
      publishFestivalCampaign(newCampaign.id, 'Instant publication from Admin CMS');
    }

    setShowScheduleModal(false);
    setActiveSubTab('campaigns');
    showToast(
      andPublish ? 'Campaign launched and published live!' : 'Campaign scheduled successfully!',
      'success'
    );
  };

  // Open Pre-Publish Validation
  const handleValidateCampaign = (campaign: FestivalCampaign) => {
    const res = validateFestivalCampaign(campaign);
    setValidationResult(res);
    setSelectedRollbackCampaign(campaign);
    setShowValidationModal(true);
  };

  // Perform Rollback
  const handleRollback = (campaignId: string, versionNum: number) => {
    const res = rollbackFestivalCampaign(campaignId, versionNum);
    if (res.success) {
      showToast(res.message, 'success');
      setShowRollbackModal(false);
    } else {
      showToast(res.message, 'error');
    }
  };

  // Mock campaign object for live preview during editing
  const previewCampaignObj: FestivalCampaign = useMemo(() => {
    if (editingCampaign) return editingCampaign;
    if (editingTemplate) {
      return {
        id: 'preview-cmp',
        name: editingTemplate.name,
        festivalName: editingTemplate.name,
        templateId: editingTemplate.id,
        templateVersion: editingTemplate.version,
        status: 'PUBLISHED',
        priority: 100,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        timezone: 'Asia/Kolkata',
        configurationSnapshot: {
          theme: editingTemplate.theme,
          sections: editingTemplate.sections,
          festivalName: editingTemplate.name,
        },
        currentVersion: 1,
        versionHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return festivalCampaigns[0] || ({} as FestivalCampaign);
  }, [editingCampaign, editingTemplate, festivalCampaigns]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── 1. CMS HEADER & EMERGENCY CONTROL ── */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Festival Campaign CMS
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  AI Design System
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Website + Android Customer App Shared Seasonal Merchandising Engine
              </p>
            </div>
          </div>
        </div>

        {/* Master Emergency Switch & AI Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md transition-all transform active:scale-95 cursor-pointer"
          >
            <Bot className="w-4 h-4" />
            <span>Create with AI</span>
          </button>

          {/* Emergency Kill Switch */}
          <button
            onClick={() => {
              const res = toggleEmergencyFestivalDisable();
              showToast(
                res
                  ? 'EMERGENCY: All festival campaigns disabled. Normal homepage active.'
                  : 'Festival campaigns enabled and active.',
                res ? 'error' : 'success'
              );
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all border cursor-pointer ${
              isFestivalEmergencyDisabled
                ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
            }`}
            title="Emergency Switch: Instantly fallback to standard homepage"
          >
            {isFestivalEmergencyDisabled ? (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>CAMPAIGNS DISABLED</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>CAMPAIGNS LIVE</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 2. SUB-TABS NAVIGATION ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
        {[
          { id: 'campaigns', label: 'Live & Scheduled Campaigns', count: festivalCampaigns.length, icon: Calendar },
          { id: 'templates', label: 'Template Library', count: festivalTemplates.length, icon: Layers },
          { id: 'builder', label: 'Section Builder & Customizer', icon: Sliders },
          { id: 'audit', label: 'Audit Logs & Rollback', count: festivalAuditLogs.length, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: CAMPAIGNS MANAGER ── */}
      {activeSubTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">Campaign Schedule & Status</h2>
              <p className="text-xs text-slate-500">
                Single unified backend configuration rendered seamlessly on Website and Customer App.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {festivalCampaigns.map((camp) => {
              const isPublished = camp.status === 'PUBLISHED';
              return (
                <div
                  key={camp.id}
                  className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5 hover:border-amber-400 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isPublished
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : camp.status === 'SCHEDULED'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {camp.status}
                      </span>
                      <span className="text-xs font-bold text-slate-400">Version {camp.currentVersion || 1}</span>
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                        Priority: {camp.priority}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-xl font-black text-slate-900">{camp.name}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Start: {new Date(camp.startAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        End: {new Date(camp.endAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                      <span>Timezone: {camp.timezone}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                    <button
                      onClick={() => {
                        setEditingCampaign(camp);
                        setShowLivePreviewModal(true);
                      }}
                      className="px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => handleValidateCampaign(camp)}
                      className="px-3.5 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Validate</span>
                    </button>

                    {camp.versionHistory && camp.versionHistory.length > 1 && (
                      <button
                        onClick={() => {
                          setSelectedRollbackCampaign(camp);
                          setShowRollbackModal(true);
                        }}
                        className="px-3.5 py-2 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Rollback ({camp.versionHistory.length})</span>
                      </button>
                    )}

                    {camp.status !== 'PUBLISHED' ? (
                      <button
                        onClick={() => publishFestivalCampaign(camp.id, 'Published via Admin')}
                        className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Publish Live</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          updateFestivalCampaign(camp.id, { status: 'PAUSED' });
                          showToast('Campaign paused.', 'info');
                        }}
                        className="px-4 py-2 rounded-2xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: TEMPLATES LIBRARY ── */}
      {activeSubTab === 'templates' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar">
              {(['ALL', 'SYSTEM', 'AI_GENERATED', 'MY_TEMPLATES'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    templateCategoryFilter === cat
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL'
                    ? 'All Templates'
                    : cat === 'SYSTEM'
                    ? 'System Templates'
                    : cat === 'AI_GENERATED'
                    ? 'AI Generated'
                    : 'My Templates'}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search festival templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Thumbnail */}
                  <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                    <img
                      src={tpl.previewThumbnail}
                      alt={tpl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-900/80 text-white backdrop-blur-xs">
                        {tpl.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-slate-800 shadow-xs">
                        v{tpl.version}
                      </span>
                    </div>

                    {/* Color Swatch Dots */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-xs p-1 rounded-full">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/50"
                        style={{ backgroundColor: tpl.theme?.primaryColor }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/50"
                        style={{ backgroundColor: tpl.theme?.secondaryColor }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/50"
                        style={{ backgroundColor: tpl.theme?.accentColor }}
                      />
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-2">
                    <h3 className="text-base font-black text-slate-900 line-clamp-1">{tpl.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{tpl.description}</p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {tpl.tags?.slice(0, 4).map((tag, i) => (
                        <span key={i} className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditTemplate(tpl)}
                      className="p-2 rounded-xl text-slate-600 hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
                      title="Edit Sections"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(tpl.id)}
                      className="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                      title="Duplicate Template"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleLaunchCampaignFromTemplate(tpl)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>Use Template</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: SECTION BUILDER & LIVE CUSTOMIZER ── */}
      {activeSubTab === 'builder' && (
        <div className="space-y-4">
          {!editingTemplate ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/80 space-y-3">
              <Layers className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Template Selected for Editing</h3>
              <p className="text-xs text-slate-500">
                Select any template from the Template Library or create a new one using AI.
              </p>
              <button
                onClick={() => setActiveSubTab('templates')}
                className="px-4 py-2 rounded-2xl bg-amber-600 text-white font-bold text-xs"
              >
                Go to Template Library
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Builder Header Bar */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    EDITING TEMPLATE
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">{editingTemplate.name}</h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Device Preview Toggle */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.5 rounded-xl ${previewDevice === 'desktop' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
                      title="Desktop View"
                    >
                      <Monitor className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPreviewDevice('tablet')}
                      className={`p-1.5 rounded-xl ${previewDevice === 'tablet' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
                      title="Tablet View"
                    >
                      <Tablet className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.5 rounded-xl ${previewDevice === 'mobile' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
                      title="Mobile View"
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleSaveBuilder}
                    className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Save Changes
                  </button>

                  <button
                    onClick={() => handleLaunchCampaignFromTemplate(editingTemplate)}
                    className="px-4 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Launch Campaign</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* In-Editor AI Design Assistant Bar */}
              <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/80 rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-amber-900">Ask AI Assistant:</span>
                </div>

                <div className="flex-1 w-full flex items-center gap-2">
                  <input
                    type="text"
                    placeholder='e.g. "Add a sweets carousel", "Make color scheme emerald green & gold", "Move offers on top"'
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyAIAssistant()}
                    className="flex-1 px-3.5 py-2 rounded-2xl bg-white border border-amber-200 text-xs focus:outline-hidden focus:border-amber-500 font-medium"
                  />
                  <button
                    onClick={handleApplyAIAssistant}
                    disabled={isAiChatApplying || !aiChatInput.trim()}
                    className="px-3.5 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Apply</span>
                  </button>
                </div>
              </div>

              {/* Two-Column Editor: Sections List & Responsive Live Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Sections Reorder & Config (4 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Layout className="w-4 h-4 text-slate-600" />
                        <span>Sections Layout ({editingTemplate.sections?.length || 0})</span>
                      </h3>
                      {/* Add Section Dropdown */}
                      <button
                        onClick={() => {
                          const newSec: FestivalSectionConfig = {
                            id: `sec-custom-${Date.now()}`,
                            type: 'ProductCarousel',
                            title: 'Special Festive Treats',
                            subtitle: 'Handcrafted sweets and groceries',
                            badge: 'NEW BATCH',
                            categoryId: 'cat-sweets',
                            maxItems: 8,
                            active: true,
                          };
                          setEditingTemplate({
                            ...editingTemplate,
                            sections: [...editingTemplate.sections, newSec],
                          });
                          showToast('Added new ProductCarousel section!', 'info');
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Section</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {editingTemplate.sections?.map((sec, idx) => (
                        <div
                          key={sec.id}
                          className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-black text-slate-800">{sec.type}</span>
                              {sec.badge && (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-sm">
                                  {sec.badge}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Reorder Buttons */}
                              {idx > 0 && (
                                <button
                                  onClick={() => {
                                    const next = [...editingTemplate.sections];
                                    const [moved] = next.splice(idx, 1);
                                    next.splice(idx - 1, 0, moved);
                                    setEditingTemplate({ ...editingTemplate, sections: next });
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-700"
                                  title="Move Up"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {idx < editingTemplate.sections.length - 1 && (
                                <button
                                  onClick={() => {
                                    const next = [...editingTemplate.sections];
                                    const [moved] = next.splice(idx, 1);
                                    next.splice(idx + 1, 0, moved);
                                    setEditingTemplate({ ...editingTemplate, sections: next });
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-700"
                                  title="Move Down"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const next = editingTemplate.sections.filter((_, i) => i !== idx);
                                  setEditingTemplate({ ...editingTemplate, sections: next });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600"
                                title="Remove Section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Quick Title Editor */}
                          <input
                            type="text"
                            value={sec.title || ''}
                            onChange={(e) => {
                              const next = [...editingTemplate.sections];
                              next[idx] = { ...next[idx], title: e.target.value };
                              setEditingTemplate({ ...editingTemplate, sections: next });
                            }}
                            className="w-full px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800"
                            placeholder="Section Title"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Responsive Preview (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Live Multi-Device Preview
                    </span>
                    <span className="text-[11px] font-bold text-amber-600">
                      Using Authoritative Store Catalog & Pricing
                    </span>
                  </div>

                  {/* Responsive Frame Container */}
                  <div className="bg-slate-100 border border-slate-200 rounded-3xl p-4 flex items-center justify-center overflow-x-auto min-h-[500px]">
                    <div
                      className={`bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-300 ${
                        previewDevice === 'mobile'
                          ? 'w-[375px] max-w-full'
                          : previewDevice === 'tablet'
                          ? 'w-[768px] max-w-full'
                          : 'w-full'
                      }`}
                    >
                      <FestivalCampaignRenderer
                        campaign={previewCampaignObj}
                        isMobilePreview={previewDevice === 'mobile'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: AUDIT LOGS ── */}
      {activeSubTab === 'audit' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900">Festival CMS Audit Trail</h2>
            <span className="text-xs text-slate-400 font-bold">{festivalAuditLogs.length} Events Logged</span>
          </div>

          <div className="divide-y divide-slate-100">
            {festivalAuditLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                      {log.action}
                    </span>
                    <span className="text-slate-500 font-medium">by {log.adminName}</span>
                    {log.version && (
                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-sm font-bold">
                        v{log.version}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600">{log.details || log.targetName}</p>
                </div>
                <span className="text-slate-400 text-[10px] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE WITH AI GENERATOR ── */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Create Festival Template with AI</h3>
                  <p className="text-xs text-slate-500">Generates 4 safe, ready-made design options conforming to approved schemas.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Generator Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Festival Name</label>
                <input
                  type="text"
                  value={aiPrompt.festivalName}
                  onChange={(e) => setAiPrompt({ ...aiPrompt, festivalName: e.target.value })}
                  placeholder="e.g. Ganesh Chaturthi, Diwali, Eid..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Primary Festive Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={aiPrompt.primaryColor || '#EA580C'}
                    onChange={(e) => setAiPrompt({ ...aiPrompt, primaryColor: e.target.value })}
                    className="w-9 h-9 rounded-xl border-none cursor-pointer"
                  />
                  <input
                    type="text"
                    value={aiPrompt.primaryColor || '#EA580C'}
                    onChange={(e) => setAiPrompt({ ...aiPrompt, primaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-700">Campaign Description & Audience</label>
                <textarea
                  rows={2}
                  value={aiPrompt.festivalDescription || ''}
                  onChange={(e) => setAiPrompt({ ...aiPrompt, festivalDescription: e.target.value })}
                  placeholder="e.g. Traditional sweets, authentic Puja samagri, and snacks for family hosting..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleGenerateWithAI}
                disabled={isAiGenerating}
                className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAiGenerating ? 'Generating 4 Variations…' : 'Generate 4 Design Options'}</span>
              </button>
            </div>

            {/* Generated Variations List */}
            {aiGeneratedVariations.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  AI Generated Variations (Select One):
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aiGeneratedVariations.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-amber-500 transition-all bg-slate-50 space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          {item.optionLabel}
                        </span>
                        <h5 className="text-sm font-black text-slate-900">{item.styleTitle}</h5>
                        <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                      </div>

                      <button
                        onClick={() => handleAdoptAITemplate(item)}
                        className="w-full mt-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                      >
                        Adopt & Customize
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: SCHEDULE & LAUNCH CAMPAIGN ── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Schedule Festival Campaign</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Campaign Title</label>
                <input
                  type="text"
                  value={scheduleData.name}
                  onChange={(e) => setScheduleData({ ...scheduleData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduleData.startAt}
                    onChange={(e) => setScheduleData({ ...scheduleData, startAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduleData.endAt}
                    onChange={(e) => setScheduleData({ ...scheduleData, endAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Priority Weight (1-100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={scheduleData.priority}
                  onChange={(e) => setScheduleData({ ...scheduleData, priority: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
                <p className="text-[10px] text-slate-400">Higher priority campaigns display when date windows overlap.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleSaveCampaignSchedule(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Save as Scheduled
              </button>
              <button
                onClick={() => handleSaveCampaignSchedule(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
              >
                Publish Live Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PRE-PUBLISH VALIDATION DRAWER ── */}
      {showValidationModal && validationResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                {validationResult.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
                <span>Pre-Publish Validation</span>
              </h3>
              <button
                onClick={() => setShowValidationModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {validationResult.isValid ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                <p className="font-bold">✓ Ready for Production Deployment</p>
                <p>All component schemas, date constraints, and asset parameters validated successfully.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-rose-600">
                  {validationResult.errors.length} Problems Found — Cannot Publish:
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {validationResult.errors.map((err, i) => (
                    <div key={i} className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                      • {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VERSION ROLLBACK ── */}
      {showRollbackModal && selectedRollbackCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Campaign Version History & Rollback</h3>
              <button
                onClick={() => setShowRollbackModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedRollbackCampaign.versionHistory?.map((ver) => (
                <div
                  key={ver.versionNumber}
                  className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs bg-slate-50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">Version {ver.versionNumber}</span>
                      {selectedRollbackCampaign.currentVersion === ver.versionNumber && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500">{ver.notes || 'Saved snapshot'}</p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(ver.savedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </span>
                  </div>

                  {selectedRollbackCampaign.currentVersion !== ver.versionNumber && (
                    <button
                      onClick={() => handleRollback(selectedRollbackCampaign.id, ver.versionNumber)}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Rollback to this
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
