// "use client";

// /**
//  * TimelineEditor
//  *
//  * Editor for timeline fields with start/end dates and milestones.
//  * Used for: Timelines
//  *
//  * UI: Date pickers for start/end, cards for milestones with drag-to-reorder
//  */

// import * as React from "react";
// import { Plus, Trash2, GripVertical, Calendar } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { Card, CardContent } from "@/components/ui/card";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { Calendar as CalendarComponent } from "@/components/ui/calendar";
// import { cn } from "@/lib/utils";
// import { format, parseISO, isValid } from "date-fns";
// import type { TimelinesValue, MilestoneValue } from "@/lib/validators/structured-field-schemas";
// import type { StructuredFieldEditorProps } from "./index";

// /**
//  * Normalizes value to TimelinesValue shape
//  */
// function normalizeTimeline(value: unknown): TimelinesValue {
//   if (typeof value === "object" && value !== null && !Array.isArray(value)) {
//     const v = value as Record<string, unknown>;
//     return {
//       start: typeof v.start === "string" ? v.start : null,
//       end: typeof v.end === "string" ? v.end : null,
//       milestones: Array.isArray(v.milestones)
//         ? v.milestones.map(m => ({
//             name: String((m as Record<string, unknown>).name || ""),
//             date: String((m as Record<string, unknown>).date || ""),
//             description: (m as Record<string, unknown>).description as string | undefined,
//           }))
//         : [],
//     };
//   }
//   return { start: null, end: null, milestones: [] };
// }

// export function TimelineEditor({
//   value,
//   onChange,
//   onSave,
//   onCancel,
//   isSaving,
// }: StructuredFieldEditorProps): React.ReactElement {
//   const timeline = React.useMemo(() => normalizeTimeline(value), [value]);

//   const handleStartChange = (date: Date | undefined) => {
//     onChange({
//       ...timeline,
//       start: date ? format(date, "yyyy-MM-dd") : null,
//     });
//   };

//   const handleEndChange = (date: Date | undefined) => {
//     onChange({
//       ...timeline,
//       end: date ? format(date, "yyyy-MM-dd") : null,
//     });
//   };

//   const handleAddMilestone = () => {
//     const newMilestone: MilestoneValue = {
//       name: "",
//       date: format(new Date(), "yyyy-MM-dd"),
//       description: "",
//     };
//     onChange({
//       ...timeline,
//       milestones: [...timeline.milestones, newMilestone],
//     });
//   };

//   const handleUpdateMilestone = (index: number, updates: Partial<MilestoneValue>) => {
//     const newMilestones = [...timeline.milestones];
//     newMilestones[index] = { ...newMilestones[index], ...updates };
//     onChange({
//       ...timeline,
//       milestones: newMilestones,
//     });
//   };

//   const handleDeleteMilestone = (index: number) => {
//     onChange({
//       ...timeline,
//       milestones: timeline.milestones.filter((_, i) => i !== index),
//     });
//   };

//   const handleMoveMilestone = (fromIndex: number, toIndex: number) => {
//     const newMilestones = [...timeline.milestones];
//     const [removed] = newMilestones.splice(fromIndex, 1);
//     newMilestones.splice(toIndex, 0, removed);
//     onChange({
//       ...timeline,
//       milestones: newMilestones,
//     });
//   };

//   // Parse dates for calendar - handle malformed dates gracefully
//   const startDate = React.useMemo(() => {
//     if (!timeline.start) return undefined;
//     try {
//       const parsed = parseISO(timeline.start);
//       return isValid(parsed) ? parsed : undefined;
//     } catch {
//       return undefined;
//     }
//   }, [timeline.start]);

//   const endDate = React.useMemo(() => {
//     if (!timeline.end) return undefined;
//     try {
//       const parsed = parseISO(timeline.end);
//       return isValid(parsed) ? parsed : undefined;
//     } catch {
//       return undefined;
//     }
//   }, [timeline.end]);

//   return (
//     <div className="space-y-6">
//       {/* Date Range */}
//       <div className="grid grid-cols-2 gap-4">
//         <div className="space-y-2">
//           <Label htmlFor="start-date" className="text-sm font-medium">
//             Start Date
//           </Label>
//           <DatePicker
//             id="start-date"
//             date={startDate}
//             onSelect={handleStartChange}
//             placeholder="Select start date"
//           />
//         </div>
//         <div className="space-y-2">
//           <Label htmlFor="end-date" className="text-sm font-medium">
//             End Date
//           </Label>
//           <DatePicker
//             id="end-date"
//             date={endDate}
//             onSelect={handleEndChange}
//             placeholder="Select end date"
//           />
//         </div>
//       </div>

//       {/* Milestones */}
//       <div className="space-y-3">
//         <div className="flex items-center justify-between">
//           <Label className="text-sm font-medium">Milestones</Label>
//           <span className="text-xs text-muted-foreground">
//             {timeline.milestones.length} {timeline.milestones.length === 1 ? "milestone" : "milestones"}
//           </span>
//         </div>

//         <div className="space-y-3">
//           {timeline.milestones.map((milestone, index) => (
//             <MilestoneCard
//               key={index}
//               milestone={milestone}
//               index={index}
//               totalCount={timeline.milestones.length}
//               onChange={(updates) => handleUpdateMilestone(index, updates)}
//               onDelete={() => handleDeleteMilestone(index)}
//               onMoveUp={() => index > 0 && handleMoveMilestone(index, index - 1)}
//               onMoveDown={() =>
//                 index < timeline.milestones.length - 1 &&
//                 handleMoveMilestone(index, index + 1)
//               }
//             />
//           ))}

//           {timeline.milestones.length === 0 && (
//             <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
//               No milestones yet. Add one to get started.
//             </div>
//           )}
//         </div>

//         <Button
//           type="button"
//           variant="outline"
//           size="sm"
//           onClick={handleAddMilestone}
//           className="w-full"
//         >
//           <Plus className="h-4 w-4 mr-2" />
//           Add Milestone
//         </Button>
//       </div>

//       {/* Action buttons */}
//       <div className="flex items-center justify-end gap-2 pt-4 border-t">
//         <Button variant="outline" onClick={onCancel} disabled={isSaving}>
//           Cancel
//         </Button>
//         <Button onClick={onSave} disabled={isSaving}>
//           {isSaving ? "Saving..." : "Save Changes"}
//         </Button>
//       </div>
//     </div>
//   );
// }

// /**
//  * Date picker component
//  */
// interface DatePickerProps {
//   id: string;
//   date?: Date;
//   onSelect: (date: Date | undefined) => void;
//   placeholder?: string;
// }

// function DatePicker({ id, date, onSelect, placeholder }: DatePickerProps): React.ReactElement {
//   const [open, setOpen] = React.useState(false);

//   return (
//     <Popover open={open} onOpenChange={setOpen}>
//       <PopoverTrigger asChild>
//         <Button
//           id={id}
//           variant="outline"
//           className={cn(
//             "w-full justify-start text-left font-normal h-10",
//             !date && "text-muted-foreground"
//           )}
//         >
//           <Calendar className="mr-2 h-4 w-4" />
//           {date ? format(date, "PPP") : placeholder || "Pick a date"}
//         </Button>
//       </PopoverTrigger>
//       <PopoverContent className="w-auto p-0" align="start">
//         <CalendarComponent
//           mode="single"
//           selected={date}
//           onSelect={(newDate) => {
//             onSelect(newDate);
//             setOpen(false);
//           }}
//           initialFocus
//         />
//       </PopoverContent>
//     </Popover>
//   );
// }

// /**
//  * Milestone card component
//  */
// interface MilestoneCardProps {
//   milestone: MilestoneValue;
//   index: number;
//   totalCount: number;
//   onChange: (updates: Partial<MilestoneValue>) => void;
//   onDelete: () => void;
//   onMoveUp: () => void;
//   onMoveDown: () => void;
// }

// function MilestoneCard({
//   milestone,
//   index,
//   totalCount,
//   onChange,
//   onDelete,
//   onMoveUp,
//   onMoveDown,
// }: MilestoneCardProps): React.ReactElement {
//   // Parse milestone date safely
//   const milestoneDate = React.useMemo(() => {
//     if (!milestone.date) return undefined;
//     try {
//       const parsed = parseISO(milestone.date);
//       return isValid(parsed) ? parsed : undefined;
//     } catch {
//       return undefined;
//     }
//   }, [milestone.date]);

//   return (
//     <Card className="group relative">
//       <CardContent className="p-4">
//         <div className="flex gap-3">
//           {/* Drag handle */}
//           <div className="flex flex-col items-center gap-1 pt-2">
//             <div className="cursor-grab opacity-30 group-hover:opacity-60">
//               <GripVertical className="h-5 w-5 text-muted-foreground" />
//             </div>
//             {totalCount > 1 && (
//               <div className="flex flex-col gap-0.5">
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="icon"
//                   onClick={onMoveUp}
//                   disabled={index === 0}
//                   className="h-6 w-6"
//                   aria-label="Move up"
//                 >
//                   <span className="text-xs">^</span>
//                 </Button>
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="icon"
//                   onClick={onMoveDown}
//                   disabled={index === totalCount - 1}
//                   className="h-6 w-6"
//                   aria-label="Move down"
//                 >
//                   <span className="text-xs rotate-180">^</span>
//                 </Button>
//               </div>
//             )}
//           </div>

//           {/* Content */}
//           <div className="flex-1 space-y-3">
//             <div className="grid grid-cols-2 gap-3">
//               <div className="space-y-1.5">
//                 <Label htmlFor={`milestone-name-${index}`} className="text-xs text-muted-foreground">
//                   Name
//                 </Label>
//                 <Input
//                   id={`milestone-name-${index}`}
//                   value={milestone.name}
//                   onChange={(e) => onChange({ name: e.target.value })}
//                   placeholder="Milestone name"
//                   className="h-9"
//                 />
//               </div>
//               <div className="space-y-1.5">
//                 <Label htmlFor={`milestone-date-${index}`} className="text-xs text-muted-foreground">
//                   Date
//                 </Label>
//                 <DatePicker
//                   id={`milestone-date-${index}`}
//                   date={milestoneDate}
//                   onSelect={(date) =>
//                     onChange({ date: date ? format(date, "yyyy-MM-dd") : "" })
//                   }
//                   placeholder="Select date"
//                 />
//               </div>
//             </div>

//             <div className="space-y-1.5">
//               <Label
//                 htmlFor={`milestone-desc-${index}`}
//                 className="text-xs text-muted-foreground"
//               >
//                 Description (optional)
//               </Label>
//               <Textarea
//                 id={`milestone-desc-${index}`}
//                 value={milestone.description || ""}
//                 onChange={(e) => onChange({ description: e.target.value })}
//                 placeholder="Brief description of what this milestone represents..."
//                 className="min-h-[60px] resize-none text-sm"
//               />
//             </div>
//           </div>

//           {/* Delete button */}
//           <Button
//             type="button"
//             variant="ghost"
//             size="icon"
//             onClick={onDelete}
//             className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
//             aria-label="Delete milestone"
//           >
//             <Trash2 className="h-4 w-4" />
//           </Button>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
