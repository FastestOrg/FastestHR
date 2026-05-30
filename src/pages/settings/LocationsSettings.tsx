import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Settings2, MapPin, Loader2 } from 'lucide-react';

export default function LocationsSettings() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [locForm, setLocForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius_meters: '200',
    is_active: true,
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['company-locations-settings', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_locations')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const getCoordinates = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocForm(f => ({
          ...f,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
        toast.success('Coordinates retrieved successfully!');
      },
      (error) => {
        console.error(error);
        setIsLocating(false);
        toast.error('Failed to get coordinates. Please enter manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveLocation = useMutation({
    mutationFn: async () => {
      if (!locForm.name.trim()) throw new Error('Location name is required');
      const lat = parseFloat(locForm.latitude);
      const lng = parseFloat(locForm.longitude);
      const rad = parseInt(locForm.radius_meters);

      if (isNaN(lat) || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90');
      if (isNaN(lng) || lng < -180 || lng > 180) throw new Error('Longitude must be between -180 and 180');
      if (isNaN(rad) || rad <= 0) throw new Error('Geofence radius must be greater than 0');

      const payload = {
        company_id: companyId!,
        name: locForm.name.trim(),
        latitude: lat,
        longitude: lng,
        radius_meters: rad,
        is_active: locForm.is_active,
      };

      if (editingLocation) {
        const { error } = await supabase
          .from('company_locations')
          .update(payload)
          .eq('id', editingLocation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_locations')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-locations-settings'] });
      toast.success(editingLocation ? 'Office location updated' : 'Office location added');
      setDialogOpen(false);
      setEditingLocation(null);
      setLocForm({ name: '', latitude: '', longitude: '', radius_meters: '200', is_active: true });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to save location')),
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_locations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-locations-settings'] });
      toast.success('Office location deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to delete location')),
  });

  const handleEdit = (loc: any) => {
    setEditingLocation(loc);
    setLocForm({
      name: loc.name,
      latitude: loc.latitude.toString(),
      longitude: loc.longitude.toString(),
      radius_meters: loc.radius_meters.toString(),
      is_active: loc.is_active,
    });
    setDialogOpen(true);
  };

  const handleCreateNew = () => {
    setEditingLocation(null);
    setLocForm({ name: '', latitude: '', longitude: '', radius_meters: '200', is_active: true });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Branch Geofencing</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage physical coordinates and geofences for different company offices and branches</p>
        </div>
        <Button onClick={handleCreateNew} size="sm" className="gap-1 font-semibold">
          <Plus className="w-4 h-4" /> Add Location
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Office Location' : 'Add Office Location'}</DialogTitle>
            <DialogDescription>Define distinct geographical boundaries for attendance validation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Location / Branch Name</Label>
              <Input placeholder="e.g. Headquarters, London Branch" value={locForm.name} onChange={(e) => setLocForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50 border-border/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input placeholder="e.g. 51.5074" type="number" step="any" value={locForm.latitude} onChange={(e) => setLocForm(f => ({ ...f, latitude: e.target.value }))} className="bg-background/50 border-border/50" />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input placeholder="e.g. -0.1278" type="number" step="any" value={locForm.longitude} onChange={(e) => setLocForm(f => ({ ...f, longitude: e.target.value }))} className="bg-background/50 border-border/50" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" className="w-full gap-1.5" onClick={getCoordinates} disabled={isLocating}>
                {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                Get Current Coordinates
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Geofence Radius (meters)</Label>
              <Input type="number" value={locForm.radius_meters} onChange={(e) => setLocForm(f => ({ ...f, radius_meters: e.target.value }))} className="bg-background/50 border-border/50" />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={locForm.is_active}
                onChange={(e) => setLocForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
              />
              <Label htmlFor="is_active" className="cursor-pointer text-sm">Active and enforcing geofence</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveLocation.mutate()} disabled={saveLocation.isPending}>
              {saveLocation.isPending ? 'Saving...' : editingLocation ? 'Update Location' : 'Create Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : locations.length === 0 ? (
        <Card className="border-border/50 bg-card py-12 text-center text-muted-foreground text-sm">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20 text-primary" />
          <p className="font-medium text-sm">No custom branch locations defined yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add branch locations above to enforce GPS clock-in zones.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {locations.map((loc: any) => (
            <Card key={loc.id} className="border-border/50 bg-card/60 hover:bg-card/90 transition-all duration-200 shadow-sm overflow-hidden">
              <div className="p-5 flex flex-col justify-between h-full gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">{loc.name}</p>
                      {loc.is_active ? (
                        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 font-mono">Coordinates: {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">Radius: {loc.radius_meters} meters</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(loc)} aria-label="Edit location">
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteLocation.mutate(loc.id)} aria-label="Delete location">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
